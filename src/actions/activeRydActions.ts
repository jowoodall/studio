
'use server';

import admin from '@/lib/firebaseAdmin'; // Using firebaseAdmin for server-side operations
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ActiveRyd, PassengerManifestItem, UserProfileData, UserRole, RydData, RydStatus, EventData} from '@/types'; // Added RydData, RydStatus, EventData
import { PassengerManifestStatus, ActiveRydStatus as ARStatus } from '@/types'; // Import ActiveRydStatus as a value with alias
import * as z from 'zod';

const db = admin.firestore(); // Get Firestore instance from the admin SDK

// Helper function to get user profile
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
  const userDocRef = db.collection('users').doc(userId);
  const userDocSnap = await userDocRef.get();
  if (!userDocSnap.exists) {
    return null;
  }
  return userDocSnap.data() as UserProfileData;
}

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

    if (requesterProfile.uid !== passengerUserId) { // Requester is different from passenger (i.e., parent)
      if (requesterProfile.role !== 'parent') {
        return { success: false, message: "Only parents can request for other users." };
      }
      if (!requesterProfile.managedStudentIds?.includes(passengerUserId)) {
        return { success: false, message: "You are not authorized to request a ryd for this student." };
      }
    }

    // --- Transactional Read-Modify-Write ---
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);

      if (!activeRydDocSnap.exists) {
        throw new Error("The selected ryd offer does not exist.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      // Validations for ActiveRyd
      const joinableRydStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
      if (!joinableRydStatuses.includes(activeRydData.status)) {
        throw new Error(`This ryd is no longer accepting new passengers (Status: ${activeRydData.status}).`);
      }

      const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
      const activePassengersCount = activeRydData.passengerManifest.filter(p =>
          p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
          p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
          p.status !== PassengerManifestStatus.MISSED_PICKUP
      ).length;

      if (activePassengersCount >= passengerCapacity) {
        throw new Error("This ryd is already full.");
      }

      const existingPassengerEntry = activeRydData.passengerManifest.find(
        p => p.userId === passengerUserId &&
             p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
             p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
      );
      if (existingPassengerEntry) {
        throw new Error(`${passengerProfile.fullName} is already on this ryd or has a pending request.`);
      }
      
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
        status: PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
        requestedAt: Timestamp.now(),
      };
      
      const newStatus = activeRydData.status === ARStatus.AWAITING_PASSENGERS ? ARStatus.PLANNING : activeRydData.status;

      transaction.update(activeRydDocRef, {
        passengerManifest: FieldValue.arrayUnion(newManifestItem),
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const successMessage = `${passengerProfile.fullName}'s request to join the ryd has been sent to the driver for approval.`;
    console.log("[Action: requestToJoinActiveRydAction] Transaction successful for rydId:", activeRydId);
    return {
        success: true,
        message: successMessage,
        rydId: activeRydId,
    };

  } catch (error: any) {
    console.error("[Action: requestToJoinActiveRydAction] Error processing request:", error);
    if (error.message && (error.message.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED')) {
       return {
        success: false,
        message: `A server authentication or timeout error occurred. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment. Details: ${error.message}`
       };
    }
    return {
        success: false,
        message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
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

  try {
    const resultMessage = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      if (activeRydData.driverId !== actingUserId) {
        throw new Error("Unauthorized: Only the driver can manage join requests.");
      }

      const passengerIndex = activeRydData.passengerManifest.findIndex(
        (p) => p.userId === passengerUserId && p.status === PassengerManifestStatus.PENDING_DRIVER_APPROVAL
      );

      if (passengerIndex === -1) {
        throw new Error("Passenger request not found or not in pending state.");
      }
      
      const passengerProfile = await getUserProfile(passengerUserId);
      const passengerName = passengerProfile?.fullName || `User ${passengerUserId.substring(0,6)}`;

      if (newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER) {
        const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
        const confirmedPassengersCount = activeRydData.passengerManifest.filter(
          p => p.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER || p.status === PassengerManifestStatus.AWAITING_PICKUP || p.status === PassengerManifestStatus.ON_BOARD
        ).length;

        if (confirmedPassengersCount >= passengerCapacity) {
          throw new Error(`Cannot approve ${passengerName}: Ryd is already full.`);
        }
      } else if (newStatus !== PassengerManifestStatus.REJECTED_BY_DRIVER) {
        throw new Error("Invalid status update."); 
      }
      
      const updatedManifest = [...activeRydData.passengerManifest];
      updatedManifest[passengerIndex].status = newStatus;
      
      // If passenger is confirmed, status should be PLANNING
      const newRydStatus = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? ARStatus.PLANNING : activeRydData.status;

      transaction.update(activeRydDocRef, {
        passengerManifest: updatedManifest,
        status: newRydStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      const actionVerb = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? "approved" : "rejected";
      return `Passenger ${passengerName}'s request has been ${actionVerb}.`;
    });

    console.log(`[Action: managePassengerJoinRequestAction] Transaction successful for rydId: ${activeRydId}`);
    return { success: true, message: resultMessage };

  } catch (error: any) {
    console.error("[Action: managePassengerJoinRequestAction] Error processing request:", error);
    return {
        success: false,
        message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
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

      const passengerIndex = activeRydData.passengerManifest.findIndex(p => p.userId === passengerUserIdToCancel);
      if (passengerIndex === -1) {
        throw new Error("Passenger not found on this ryd.");
      }

      const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];
      const passengerProfile = await getUserProfile(passengerUserIdToCancel);
      const passengerName = passengerProfile?.fullName || `User ${passengerUserIdToCancel.substring(0, 6)}`;

      const cancellablePassengerStatuses = [
        PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
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
      
      const remainingActivePassengers = updatedManifest.filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER && p.status !== PassengerManifestStatus.MISSED_PICKUP).length;
      
      const updatePayload: { passengerManifest: PassengerManifestItem[], updatedAt: FieldValue, status?: ARStatus } = {
        passengerManifest: updatedManifest,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      if (remainingActivePassengers === 0 && activeRydData.status === ARStatus.PLANNING) {
        updatePayload.status = ARStatus.AWAITING_PASSENGERS;
      }

      transaction.update(activeRydDocRef, updatePayload);

      return { passengerName };
    });

    console.log(`[Action: cancelPassengerSpotAction] Successfully cancelled spot for passenger ${result.passengerName} on rydId: ${activeRydId}`);
    return { success: true, message: `Spot for ${result.passengerName} on the ryd has been successfully cancelled.` };

  } catch (error: any) {
    console.error("[Action: cancelPassengerSpotAction] Error processing request:", error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
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
      
      const isDriver = activeRydData.driverId === actingUserId;
      const isPassenger = passengerUserId === actingUserId;
      if (!isDriver && !isPassenger) throw new Error("Unauthorized: Only the driver or the passenger can confirm pickup.");

      if (activeRydData.status !== ARStatus.IN_PROGRESS_PICKUP) throw new Error(`Cannot update pickup status. Ryd is not in pickup phase (Status: ${activeRydData.status}).`);
      if (activeRydData.passengerManifest[passengerIndex].status !== PassengerManifestStatus.CONFIRMED_BY_DRIVER) throw new Error("Passenger is not in a confirmed state for pickup.");

      const updatedManifest = [...activeRydData.passengerManifest];
      updatedManifest[passengerIndex].status = PassengerManifestStatus.ON_BOARD;
      updatedManifest[passengerIndex].actualPickupTime = Timestamp.now();
      
      const activePassengers = updatedManifest.filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER && p.status !== PassengerManifestStatus.MISSED_PICKUP);
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
    console.error("[Action: updatePassengerPickupStatusAction] Error:", error);
    return { success: false, message: error.message || "An unexpected server error occurred." };
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
    console.error("[Action: fulfillRequestWithExistingRydAction] Error processing fulfillment:", error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || "Unknown server error"}`,
    };
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
    console.error("[Action: submitPassengerDetailsForActiveRydAction] Error processing request:", error);
    return {
        success: false,
        message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
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
    console.error("[Action: cancelRydRequestByUserAction] Error processing request:", error);
    return {
      success: false,
      message: `An unexpected error occurred while cancelling: ${error.message || "Unknown server error"}`
    };
  }
}
    
