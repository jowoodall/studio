
'use server';

import admin from '@/lib/firebaseAdmin'; // Using firebaseAdmin for server-side operations
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ActiveRyd, PassengerManifestItem, UserProfileData, UserRole, RydData, RydStatus, EventData, RydMessage, NotificationType} from '@/types';
import { PassengerManifestStatus, ActiveRydStatus as ARStatus, UserRole as RoleEnum, NotificationType as NotificationTypeEnum } from '@/types';
import * as z from 'zod';
import { nanoid } from 'nanoid';
import { createNotification } from './notificationActions';

const db = admin.firestore(); // Get Firestore instance from the admin SDK

// Helper function to get user profile (not transaction-aware)
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
  const userDocRef = db.collection('users').doc(userId);
  const userDocSnap = await userDocRef.get();
  if (!userDocSnap.exists) {
    return null;
  }
  return { uid: userDocSnap.id, ...userDocSnap.data() } as UserProfileData;
}

const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";

    // Handle Firestore index errors
    if (error.code === 5 || error.code === 'failed-precondition' || (errorMessage.toLowerCase().includes("index") || errorMessage.toLowerCase().includes("missing a composite index"))) {
      return { success: false, message: `A Firestore index is required for this query. Please check your server terminal logs for an error message from Firestore that contains a link to create the necessary index automatically.` };
    }

    if (errorMessage.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED') {
        return {
            success: false,
            message: `A server authentication or timeout error occurred. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`
        };
    }
    return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
};


interface RequestToJoinActiveRydInput {
  activeRydId: string;
  passengerUserId: string;
  requestedByUserId: string; // UID of the person clicking the button (could be parent)
}

export async function requestToJoinActiveRydAction(
  input: RequestToJoinActiveRydInput
): Promise<{ success: boolean; message: string; rydId?: string }> {
  console.log("[Action: requestToJoinActiveRydAction] Called with input:", input);

  const { activeRydId, passengerUserId, requestedByUserId } = input;

  if (!activeRydId || !passengerUserId || !requestedByUserId) {
    return { success: false, message: "Missing required IDs." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    // --- Authorization and Profile Checks (run in parallel for efficiency) ---
    const [requesterProfile, passengerProfile] = await Promise.all([
      getUserProfile(requestedByUserId),
      getUserProfile(passengerUserId),
    ]);

    if (!requesterProfile) {
      return { success: false, message: "Requester profile not found." };
    }
    if (!passengerProfile) {
      return { success: false, message: "Passenger profile not found." };
    }

    // Authorization: Requester must be the passenger OR a parent managing that passenger
    if (requesterProfile.uid !== passengerUserId) {
      if (requesterProfile.role !== RoleEnum.PARENT) {
        return { success: false, message: "Only parents can request for other users." };
      }
      if (!requesterProfile.managedStudentIds?.includes(passengerUserId)) {
        return { success: false, message: "You are not authorized to request a ryd for this student." };
      }
    }

    // --- Transactional Read-Modify-Write ---
    const resultData = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);

      if (!activeRydDocSnap.exists) {
        throw new Error("The selected ryd offer does not exist.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      // Validations for ActiveRyd state
      const joinableRydStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
      if (!joinableRydStatuses.includes(activeRydData.status)) {
        throw new Error(`This ryd is no longer accepting new passengers (Status: ${activeRydData.status}).`);
      }

      const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
      const activePassengersCount = activeRydData.passengerManifest.filter(p =>
          p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
          p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
          p.status !== PassengerManifestStatus.REJECTED_BY_PARENT &&
          p.status !== PassengerManifestStatus.MISSED_PICKUP
      ).length;

      if (activePassengersCount >= passengerCapacity) {
        throw new Error("This ryd is already full.");
      }

      const existingPassengerEntry = activeRydData.passengerManifest.find(
        p => p.userId === passengerUserId &&
             p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
             p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
             p.status !== PassengerManifestStatus.REJECTED_BY_PARENT
      );
      if (existingPassengerEntry) {
        throw new Error(`${passengerProfile.fullName} is already on this ryd or has a pending request.`);
      }
      
      // --- Parent Approval Logic ---
      let finalStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL;
      let approvalRequired = false;
      let finalMessage = `${passengerProfile.fullName}'s request to join the ryd has been sent to the driver for approval.`;
      let parentIdForNotification: string | null = null;

      if (passengerProfile.role === RoleEnum.STUDENT && passengerProfile.associatedParentIds && passengerProfile.associatedParentIds.length > 0) {
        const parentId = passengerProfile.associatedParentIds[0]; // Assuming one parent for now
        const parentDocRef = db.collection('users').doc(parentId);
        const parentDocSnap = await transaction.get(parentDocRef);

        if (parentDocSnap.exists) {
          const parentProfile = parentDocSnap.data() as UserProfileData;
          const isDriverApproved = parentProfile.approvedDrivers?.[activeRydData.driverId]?.includes(passengerUserId) ?? false;
          
          if (!isDriverApproved) {
            finalStatus = PassengerManifestStatus.PENDING_PARENT_APPROVAL;
            approvalRequired = true;
            finalMessage = `The driver for this ryd has not been approved yet. A request has been sent to ${parentProfile.fullName} for approval.`;
            parentIdForNotification = parentProfile.uid;
          }
        }
      }
      // --- End Parent Approval Logic ---

      const passengerPickupStreet = passengerProfile.address?.street || "";
      const passengerPickupCity = passengerProfile.address?.city || "";
      const passengerPickupState = passengerProfile.address?.state || "";
      const passengerPickupZip = passengerProfile.address?.zip || "";

      let fullPickupAddress = [passengerPickupStreet, passengerPickupCity, passengerPickupState, passengerPickupZip].filter(Boolean).join(", ");
      if (fullPickupAddress.trim() === "") {
          fullPickupAddress = "Pickup to be coordinated";
      }
      
      const newManifestItem: PassengerManifestItem = {
        userId: passengerUserId,
        pickupAddress: fullPickupAddress,
        destinationAddress: activeRydData.finalDestinationAddress || "Event Destination",
        status: finalStatus,
        requestedAt: Timestamp.now(),
      };
      
      const updatePayload: any = {
        passengerManifest: FieldValue.arrayUnion(newManifestItem),
        passengerUids: FieldValue.arrayUnion(passengerUserId),
        status: activeRydData.status === ARStatus.AWAITING_PASSENGERS ? ARStatus.PLANNING : activeRydData.status,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      if (approvalRequired) {
        updatePayload.uidsPendingParentalApproval = FieldValue.arrayUnion(passengerUserId);
      }

      transaction.update(activeRydDocRef, updatePayload);
      
      return { 
        finalMessage, 
        driverId: activeRydData.driverId,
        isParentalApproval: approvalRequired,
        parentId: parentIdForNotification,
      };
    });
    
    // --- Create notification outside of transaction ---
    const passengerName = passengerProfile.fullName;
    const { driverId, isParentalApproval, parentId } = resultData;

    if (isParentalApproval && parentId) {
        await createNotification(
            parentId,
            'Ryd Approval Required',
            `Your approval is required for ${passengerName} to join a ryd.`,
            NotificationTypeEnum.WARNING,
            '/parent/approvals'
        );
    } else {
        await createNotification(
            driverId,
            'New Ryd Request',
            `${passengerName} has requested to join your ryd.`,
            NotificationTypeEnum.INFO,
            `/rydz/tracking/${activeRydId}`
        );
    }
    // --- End notification creation ---

    console.log("[Action: requestToJoinActiveRydAction] Transaction successful for rydId:", activeRydId);
    return {
        success: true,
        message: resultData.finalMessage,
        rydId: activeRydId,
    };

  } catch (error: any) {
    return handleActionError(error, "requestToJoinActiveRydAction");
  }
}


interface ManagePassengerRequestInput {
  activeRydId: string;
  passengerUserId: string;
  newStatus: PassengerManifestStatus.CONFIRMED_BY_DRIVER | PassengerManifestStatus.REJECTED_BY_DRIVER;
  actingUserId: string;
}

export async function managePassengerJoinRequestAction(
  input: ManagePassengerRequestInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: managePassengerJoinRequestAction] Called with input:", input);
  const { activeRydId, passengerUserId, newStatus, actingUserId } = input;

  if (!activeRydId || !passengerUserId || !newStatus || !actingUserId) {
    return { success: false, message: "Missing required parameters for managing passenger request." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  const driverDocRef = db.collection('users').doc(actingUserId);

  try {
    let activeRydData: ActiveRyd | null = null;
    const resultMessage = await db.runTransaction(async (transaction) => {
      const [activeRydDocSnap, driverDocSnap] = await transaction.getAll(activeRydDocRef, driverDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      if (!driverDocSnap.exists) {
        throw new Error("Acting user/driver profile not found.");
      }
      
      const rydData = activeRydDocSnap.data() as ActiveRyd;
      activeRydData = rydData; // Assign for use outside transaction

      if (rydData.driverId !== actingUserId) {
        throw new Error("Unauthorized: Only the driver can manage join requests.");
      }

      const passengerIndex = rydData.passengerManifest.findIndex(
        (p) => p.userId === passengerUserId && p.status === PassengerManifestStatus.PENDING_DRIVER_APPROVAL
      );

      if (passengerIndex === -1) {
        throw new Error("Passenger request not found or not in pending state.");
      }
      
      const passengerProfile = await getUserProfile(passengerUserId);
      const passengerName = passengerProfile?.fullName || `User ${passengerUserId.substring(0,6)}`;

      if (newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER) {
        const passengerCapacity = parseInt(rydData.vehicleDetails?.passengerCapacity || "0", 10);
        const confirmedPassengersCount = rydData.passengerManifest.filter(
          p => p.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER || p.status === PassengerManifestStatus.AWAITING_PICKUP || p.status === PassengerManifestStatus.ON_BOARD
        ).length;

        if (confirmedPassengersCount >= passengerCapacity) {
          throw new Error(`Cannot approve ${passengerName}: Ryd is already full.`);
        }
      } else if (newStatus !== PassengerManifestStatus.REJECTED_BY_DRIVER) {
        throw new Error("Invalid status update."); 
      }
      
      const updatedManifest = [...rydData.passengerManifest];
      updatedManifest[passengerIndex].status = newStatus;
      
      const newRydStatus = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? ARStatus.PLANNING : rydData.status;

      const updatePayload: any = {
        passengerManifest: updatedManifest,
        status: newRydStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      if (newStatus === PassengerManifestStatus.REJECTED_BY_DRIVER) {
          updatePayload.passengerUids = FieldValue.arrayRemove(passengerUserId);
      }

      transaction.update(activeRydDocRef, updatePayload);
      
      const actionVerb = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? "approved" : "rejected";
      return `Passenger ${passengerName}'s request has been ${actionVerb}.`;
    });

    // --- Create notification outside of transaction ---
    if (activeRydData) {
      const driverProfile = await getUserProfile(actingUserId);
      const eventName = activeRydData.eventName || "the ryd";
      const actionVerb = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? "approved" : "rejected";
      await createNotification(
          passengerUserId,
          `Your Ryd Request was ${actionVerb}`,
          `${driverProfile?.fullName || 'The driver'} has ${actionVerb} your request to join the ryd for "${eventName}".`,
          newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? NotificationTypeEnum.SUCCESS : NotificationTypeEnum.ERROR,
          `/rydz/tracking/${activeRydId}`
      );
    }
    // --- End notification creation ---

    console.log(`[Action: managePassengerJoinRequestAction] Transaction successful for rydId: ${activeRydId}`);
    return { success: true, message: resultMessage };

  } catch (error: any) {
    return handleActionError(error, "managePassengerJoinRequestAction");
  }
}

interface CancelPassengerSpotInput {
  activeRydId: string;
  passengerUserIdToCancel: string;
  cancellingUserId: string;
}

export async function cancelPassengerSpotAction(
  input: CancelPassengerSpotInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: cancelPassengerSpotAction] Called with input:", input);
  const { activeRydId, passengerUserIdToCancel, cancellingUserId } = input;

  if (!activeRydId || !passengerUserIdToCancel || !cancellingUserId) {
    return { success: false, message: "Missing required parameters for cancelling passenger spot." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  let driverIdForNotification: string | undefined;
  let eventNameForNotification: string | undefined;

  try {
    const cancellingUserProfile = await getUserProfile(cancellingUserId);
    if (!cancellingUserProfile) {
      return { success: false, message: "Your user profile could not be found." };
    }

    const isCancellingForSelf = cancellingUserId === passengerUserIdToCancel;
    const isParentCancellingForStudent =
      cancellingUserProfile.role === 'parent' &&
      cancellingUserProfile.managedStudentIds?.includes(passengerUserIdToCancel);

    if (!isCancellingForSelf && !isParentCancellingForStudent) {
      return { success: false, message: "Unauthorized: You may only cancel for yourself or for a student you manage." };
    }
    
    const result = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;
      
      driverIdForNotification = activeRydData.driverId;
      eventNameForNotification = activeRydData.eventName;


      const passengerIndex = activeRydData.passengerManifest.findIndex(p => p.userId === passengerUserIdToCancel);
      if (passengerIndex === -1) {
        throw new Error("Passenger not found on this ryd.");
      }

      const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];
      const passengerProfile = await getUserProfile(passengerUserIdToCancel);
      const passengerName = passengerProfile?.fullName || `User ${passengerUserIdToCancel.substring(0, 6)}`;

      const cancellablePassengerStatuses = [
        PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
        PassengerManifestStatus.PENDING_PARENT_APPROVAL,
        PassengerManifestStatus.CONFIRMED_BY_DRIVER,
        PassengerManifestStatus.AWAITING_PICKUP,
      ];
      if (!cancellablePassengerStatuses.includes(passengerToUpdate.status)) {
        throw new Error(`${passengerName} cannot cancel at this stage (Current Status: ${passengerToUpdate.status.replace(/_/g, ' ')}).`);
      }

      const nonCancellableRydStatuses = [
        ARStatus.COMPLETED,
        ARStatus.CANCELLED_BY_DRIVER,
        ARStatus.CANCELLED_BY_SYSTEM,
        ARStatus.IN_PROGRESS_ROUTE,
        ARStatus.IN_PROGRESS_PICKUP
      ];
      if (nonCancellableRydStatuses.includes(activeRydData.status)) {
        throw new Error(`This ryd cannot be cancelled by a passenger at this stage (Ryd Status: ${activeRydData.status.replace(/_/g, ' ')}).`);
      }

      const updatedManifest = [...activeRydData.passengerManifest];
      updatedManifest[passengerIndex].status = PassengerManifestStatus.CANCELLED_BY_PASSENGER;
      
      const remainingActivePassengers = updatedManifest.filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER && p.status !== PassengerManifestStatus.REJECTED_BY_PARENT && p.status !== PassengerManifestStatus.MISSED_PICKUP).length;
      
      const updatePayload: { passengerManifest: PassengerManifestItem[], updatedAt: FieldValue, status?: ARStatus, passengerUids?: FieldValue, uidsPendingParentalApproval?: FieldValue } = {
        passengerManifest: updatedManifest,
        updatedAt: FieldValue.serverTimestamp(),
        passengerUids: FieldValue.arrayRemove(passengerUserIdToCancel),
      };
      
      if (passengerToUpdate.status === PassengerManifestStatus.PENDING_PARENT_APPROVAL) {
        updatePayload.uidsPendingParentalApproval = FieldValue.arrayRemove(passengerUserIdToCancel);
      }

      if (remainingActivePassengers === 0 && activeRydData.status === ARStatus.PLANNING) {
        updatePayload.status = ARStatus.AWAITING_PASSENGERS;
      }

      transaction.update(activeRydDocRef, updatePayload);

      return { passengerName };
    });
    
    // --- Create notification for driver ---
    if (driverIdForNotification) {
        await createNotification(
            driverIdForNotification,
            'Passenger Cancelled',
            `${result.passengerName} has cancelled their spot for the ryd to "${eventNameForNotification || 'your ryd'}".`,
            NotificationTypeEnum.INFO,
            `/rydz/tracking/${activeRydId}`
        );
    }
    // --- End notification creation ---

    console.log(`[Action: cancelPassengerSpotAction] Successfully cancelled spot for passenger ${result.passengerName} on rydId: ${activeRydId}`);
    return { success: true, message: `Spot for ${result.passengerName} on the ryd has been successfully cancelled.` };

  } catch (error: any) {
    return handleActionError(error, "cancelPassengerSpotAction");
  }
}

interface UpdatePassengerPickupStatusInput {
  activeRydId: string;
  passengerUserId: string;
  actingUserId: string;
}

export async function updatePassengerPickupStatusAction(
  input: UpdatePassengerPickupStatusInput
): Promise<{ success: boolean; message: string }> {
  const { activeRydId, passengerUserId, actingUserId } = input;
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    const resultMessage = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");

      const activeRydData = activeRydDocSnap.data() as ActiveRyd;
      
      const passengerIndex = activeRydData.passengerManifest.findIndex(p => p.userId === passengerUserId);
      if (passengerIndex === -1) throw new Error("Passenger not found on this ryd.");
      
      // Explicitly check for authorization
      const isDriver = activeRydData.driverId === actingUserId;
      const isPassengerSelfReporting = passengerUserId === actingUserId;
      
      let authorized = false;
      if (isDriver) {
        authorized = true; // The driver can mark any passenger as picked up
      } else if (isPassengerSelfReporting) {
        authorized = true; // A passenger can mark themselves as picked up
      }

      if (!authorized) {
        throw new Error("Unauthorized: Only the driver or the passenger themselves can confirm pickup.");
      }

      if (activeRydData.status !== ARStatus.IN_PROGRESS_PICKUP) throw new Error(`Cannot update pickup status. Ryd is not in pickup phase (Status: ${activeRydData.status}).`);
      if (activeRydData.passengerManifest[passengerIndex].status !== PassengerManifestStatus.CONFIRMED_BY_DRIVER) throw new Error("Passenger is not in a confirmed state for pickup.");

      const updatedManifest = [...activeRydData.passengerManifest];
      updatedManifest[passengerIndex].status = PassengerManifestStatus.ON_BOARD;
      updatedManifest[passengerIndex].actualPickupTime = Timestamp.now();
      
      const activePassengers = updatedManifest.filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER && p.status !== PassengerManifestStatus.REJECTED_BY_PARENT && p.status !== PassengerManifestStatus.MISSED_PICKUP);
      const allOnBoard = activePassengers.every(p => p.status === PassengerManifestStatus.ON_BOARD);
      
      const updatePayload: any = {
        passengerManifest: updatedManifest,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (allOnBoard) {
        updatePayload.status = ARStatus.IN_PROGRESS_ROUTE;
      }

      transaction.update(activeRydDocRef, updatePayload);
      
      const passengerProfile = await getUserProfile(passengerUserId);
      return allOnBoard ?
        `Passenger ${passengerProfile?.fullName} marked as on board. All passengers picked up, ryd is now en route!` :
        `Passenger ${passengerProfile?.fullName} marked as on board.`;
    });

    return { success: true, message: resultMessage };

  } catch (error: any) {
    const { success, message } = handleActionError(error, "updatePassengerPickupStatusAction");
    return { success, message: message || "An unexpected server error occurred." };
  }
}

interface FulfillRequestWithExistingRydInput {
  rydRequestId: string;
  existingActiveRydId: string;
  driverUserId: string;
}

export async function fulfillRequestWithExistingRydAction(
  input: FulfillRequestWithExistingRydInput
): Promise<{ success: boolean; message: string; activeRydId?: string }> {
  console.log("[Action: fulfillRequestWithExistingRydAction] Called with input:", input);
  const { rydRequestId, existingActiveRydId, driverUserId } = input;

  if (!rydRequestId || !existingActiveRydId || !driverUserId) {
    return { success: false, message: "Missing required IDs for fulfillment." };
  }

  const batch = db.batch();

  try {
    const rydRequestRef = db.collection('rydz').doc(rydRequestId);
    const rydRequestSnap = await rydRequestRef.get();
    if (!rydRequestSnap.exists) {
      return { success: false, message: "Ryd request not found." };
    }
    const rydRequestData = rydRequestSnap.data() as RydData;

    const activeRydRef = db.collection('activeRydz').doc(existingActiveRydId);
    const activeRydSnap = await activeRydRef.get();
    if (!activeRydSnap.exists) {
      return { success: false, message: "Existing ActiveRyd not found." };
    }
    const activeRydData = activeRydSnap.data() as ActiveRyd;

    const driverProfile = await getUserProfile(driverUserId);
    if (!driverProfile) {
      return { success: false, message: "Driver profile not found." };
    }
    if (activeRydData.driverId !== driverUserId) {
      return { success: false, message: "Mismatch: You are not the driver of the selected ActiveRyd." };
    }
     if (!driverProfile.canDrive) {
      return { success: false, message: "You are not registered or permitted to drive." };
    }

    if (rydRequestData.status !== 'requested' && rydRequestData.status !== 'searching_driver') {
      return { success: false, message: `This ryd request is no longer active (Status: ${rydRequestData.status}).` };
    }
    const joinableActiveRydStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
    if (!joinableActiveRydStatuses.includes(activeRydData.status)) {
      return { success: false, message: `Your existing ryd is not in a state to accept new passengers (Status: ${activeRydData.status}).` };
    }

    const passengersToFulfillCount = rydRequestData.passengerIds.length;
    if (passengersToFulfillCount === 0) {
      return { success: false, message: "The ryd request has no passengers specified." };
    }
    const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
    const currentPassengersInActiveRyd = activeRydData.passengerManifest.filter(p =>
        p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
        p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
        p.status !== PassengerManifestStatus.REJECTED_BY_PARENT &&
        p.status !== PassengerManifestStatus.MISSED_PICKUP
    ).length;

    if (passengerCapacity - currentPassengersInActiveRyd < passengersToFulfillCount) {
      return { success: false, message: `Your existing ryd does not have enough capacity (${passengerCapacity - currentPassengersInActiveRyd} seats available) to fulfill this request for ${passengersToFulfillCount} passenger(s).` };
    }

    const newManifestItems: PassengerManifestItem[] = [];
    let eventNameForManifest = "Event Destination"; 
    if (activeRydData.associatedEventId) {
        const eventDocRef = db.collection('events').doc(activeRydData.associatedEventId);
        const eventDocSnap = await eventDocRef.get();
        if (eventDocSnap.exists()) {
            eventNameForManifest = (eventDocSnap.data() as EventData).name;
        }
    } else if (activeRydData.finalDestinationAddress) {
        eventNameForManifest = activeRydData.finalDestinationAddress;
    }


    for (const passengerId of rydRequestData.passengerIds) {
      const passengerProfileData = await getUserProfile(passengerId); 
      let passengerPickupAddress = rydRequestData.pickupLocation || "Pickup to be coordinated"; 
      if (passengerProfileData?.address?.street) { 
        const pStreet = passengerProfileData.address.street || "";
        const pCity = passengerProfileData.address.city || "";
        const pState = passengerProfileData.address.state || "";
        const pZip = passengerProfileData.address.zip || "";
        const fullAddr = [pStreet, pCity, pState, pZip].filter(Boolean).join(", ");
        if (fullAddr.trim() !== "") passengerPickupAddress = fullAddr;
      }

      newManifestItems.push({
        userId: passengerId,
        originalRydRequestId: rydRequestId,
        pickupAddress: passengerPickupAddress,
        destinationAddress: activeRydData.finalDestinationAddress || eventNameForManifest,
        status: PassengerManifestStatus.CONFIRMED_BY_DRIVER,
        requestedAt: rydRequestData.createdAt || Timestamp.now(), 
      });
    }

    batch.update(activeRydRef, {
      passengerManifest: FieldValue.arrayUnion(...newManifestItems),
      passengerUids: FieldValue.arrayUnion(...rydRequestData.passengerIds), // Update passengerUids
      status: ARStatus.PLANNING, // It now has passengers, so it's planning
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(rydRequestRef, {
      status: 'driver_assigned' as RydStatus,
      driverId: driverUserId,
      assignedActiveRydId: existingActiveRydId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(`[Action: fulfillRequestWithExistingRydAction] Successfully fulfilled request ${rydRequestId} with existing ActiveRyd ${existingActiveRydId}.`);
    return {
      success: true,
      message: `Successfully added ${passengersToFulfillCount} passenger(s) from request to your existing ryd.`,
      activeRydId: existingActiveRydId,
    };

  } catch (error: any) {
    return handleActionError(error, "fulfillRequestWithExistingRydAction");
  }
}

interface SubmitPassengerDetailsForActiveRydInput {
  activeRydId: string;
  passengerUserId: string;
  pickupLocation: string;
  earliestPickupTimeStr: string; 
  eventDate: Date; 
  notes?: string;
}

export async function submitPassengerDetailsForActiveRydAction(
  input: SubmitPassengerDetailsForActiveRydInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: submitPassengerDetailsForActiveRydAction] Called with input:", input);
  const { activeRydId, passengerUserId, pickupLocation, earliestPickupTimeStr, eventDate, notes } = input;

  if (!activeRydId || !passengerUserId || !pickupLocation || !earliestPickupTimeStr || !eventDate) {
    return { success: false, message: "Missing required parameters for submitting passenger details." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      const passengerIndex = activeRydData.passengerManifest.findIndex(
        (p) => p.userId === passengerUserId
      );

      if (passengerIndex === -1) {
        throw new Error("You are not listed as a passenger on this ryd, or your request was removed.");
      }

      const updatedManifest = [...activeRydData.passengerManifest];
      const passengerToUpdate = { ...updatedManifest[passengerIndex] };

      passengerToUpdate.pickupAddress = pickupLocation;
      passengerToUpdate.notes = notes || "";

      const [hours, minutes] = earliestPickupTimeStr.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error("Invalid earliest pickup time format.");
      }
      const pickupDateTime = new Date(eventDate);
      pickupDateTime.setHours(hours, minutes, 0, 0);
      passengerToUpdate.earliestPickupTimestamp = Timestamp.fromDate(pickupDateTime);

      updatedManifest[passengerIndex] = passengerToUpdate;

      transaction.update(activeRydDocRef, {
        passengerManifest: updatedManifest,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Action: submitPassengerDetailsForActiveRydAction] Successfully updated details for passenger ${passengerUserId} on ryd ${activeRydId}.`);
    return { success: true, message: "Your pickup details have been successfully submitted." };

  } catch (error: any) {
    return handleActionError(error, "submitPassengerDetailsForActiveRydAction");
  }
}

interface CancelRydRequestByUserActionInput {
  rydRequestId: string;
  cancellingUserId: string;
}

export async function cancelRydRequestByUserAction(
  input: CancelRydRequestByUserActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: cancelRydRequestByUserAction] Called with input:", input);
  const { rydRequestId, cancellingUserId } = input;

  if (!rydRequestId || !cancellingUserId) {
    return { success: false, message: "Missing required parameters for cancelling ryd request." };
  }

  const rydRequestDocRef = db.collection('rydz').doc(rydRequestId);

  try {
    await db.runTransaction(async (transaction) => {
      const rydRequestSnap = await transaction.get(rydRequestDocRef);
      if (!rydRequestSnap.exists) {
        throw new Error("Ryd request not found.");
      }
      const rydRequestData = rydRequestSnap.data() as RydData;

      if (rydRequestData.requestedBy !== cancellingUserId) {
        throw new Error("Unauthorized: Only the original requester can cancel this ryd request.");
      }

      const cancellableStatuses: RydStatus[] = ['requested', 'searching_driver'];
      if (!cancellableStatuses.includes(rydRequestData.status)) {
        throw new Error(`This ryd request cannot be cancelled at this stage (Status: ${rydRequestData.status.replace(/_/g, ' ')}).`);
      }

      transaction.update(rydRequestDocRef, {
        status: 'cancelled_by_user' as RydStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Action: cancelRydRequestByUserAction] Successfully cancelled ryd request ${rydRequestId} by user ${cancellingUserId}.`);
    return { success: true, message: "Your ryd request has been successfully cancelled." };

  } catch (error: any) {
    return handleActionError(error, "cancelRydRequestByUserAction");
  }
}

interface RevertPassengerPickupInput {
  activeRydId: string;
  passengerUserId: string;
  actingUserId: string;
}

export async function revertPassengerPickupAction(
  input: RevertPassengerPickupInput
): Promise<{ success: boolean; message: string }> {
  const { activeRydId, passengerUserId, actingUserId } = input;
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    const resultMessage = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");

      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      const isDriver = activeRydData.driverId === actingUserId;
      if (!isDriver) throw new Error("Unauthorized: Only the driver can undo a pickup.");

      const passengerIndex = activeRydData.passengerManifest.findIndex(p => p.userId === passengerUserId);
      if (passengerIndex === -1) throw new Error("Passenger not found on this ryd.");
      
      const currentPassengerStatus = activeRydData.passengerManifest[passengerIndex].status;
      if (currentPassengerStatus !== PassengerManifestStatus.ON_BOARD) {
        throw new Error(`Cannot undo pickup for this passenger. Their status is: ${currentPassengerStatus}.`);
      }

      const updatedManifest = [...activeRydData.passengerManifest];
      const passengerToUpdate = { ...updatedManifest[passengerIndex] };
      passengerToUpdate.status = PassengerManifestStatus.CONFIRMED_BY_DRIVER;
      delete passengerToUpdate.actualPickupTime; // Remove timestamp
      updatedManifest[passengerIndex] = passengerToUpdate;

      const updatePayload: any = {
        passengerManifest: updatedManifest,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      // If ryd was IN_PROGRESS_ROUTE, it must now go back to IN_PROGRESS_PICKUP
      if (activeRydData.status === ARStatus.IN_PROGRESS_ROUTE) {
        updatePayload.status = ARStatus.IN_PROGRESS_PICKUP;
      }
      
      transaction.update(activeRydDocRef, updatePayload);
      
      const passengerProfile = await getUserProfile(passengerUserId);
      return `Pickup for passenger ${passengerProfile?.fullName} has been undone.`;
    });

    return { success: true, message: resultMessage };

  } catch (error: any) {
    return handleActionError(error, "revertPassengerPickupAction");
  }
}

interface SendRydMessageInput {
  activeRydId: string;
  text: string;
  senderUserId: string;
}

export async function sendRydMessageAction(
  input: SendRydMessageInput
): Promise<{ success: boolean; message: string }> {
  const { activeRydId, text, senderUserId } = input;

  if (!activeRydId || !text.trim() || !senderUserId) {
    return { success: false, message: "Missing required parameters." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  
  try {
    const senderProfile = await getUserProfile(senderUserId);
    if (!senderProfile) {
      return { success: false, message: "Sender profile not found." };
    }
    
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("Ryd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      // Authorization: Check if sender is driver or confirmed passenger
      const isDriver = activeRydData.driverId === senderUserId;
      
      const confirmedPassengerStatuses: PassengerManifestStatus[] = [
        PassengerManifestStatus.CONFIRMED_BY_DRIVER,
        PassengerManifestStatus.AWAITING_PICKUP,
        PassengerManifestStatus.ON_BOARD,
        PassengerManifestStatus.DROPPED_OFF,
      ];
      const isConfirmedPassenger = activeRydData.passengerManifest.some(p => 
        p.userId === senderUserId && confirmedPassengerStatuses.includes(p.status)
      );
      
      if (!isDriver && !isConfirmedPassenger) {
        throw new Error("You are not authorized to send messages on this ryd.");
      }
      
      const newMessage: RydMessage = {
        id: nanoid(),
        senderId: senderUserId,
        senderName: senderProfile.fullName,
        senderAvatar: senderProfile.avatarUrl || '',
        text: text.trim(),
        timestamp: Timestamp.now(),
      };
      
      transaction.update(activeRydDocRef, {
        messages: FieldValue.arrayUnion(newMessage),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: "Message sent." };

  } catch (error: any) {
    return handleActionError(error, "sendRydMessageAction");
  }
}
