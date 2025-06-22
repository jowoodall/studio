
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
): Promise<{ success: boolean; message: string; rydId?: string, passengerManifestItemId?: string }> {
  console.log("[Action: requestToJoinActiveRydAction] Called with input:", input);

  const { activeRydId, passengerUserId, requestedByUserId } = input;

  if (!activeRydId || !passengerUserId || !requestedByUserId) {
    return { success: false, message: "Missing required IDs." };
  }

  const batch = db.batch(); // Initialize batch write
  let originalRydRequestIdForManifest: string | undefined = undefined;

  try {
    // 1. Verify requester's identity and passenger relationship (if parent)
    const requesterProfile = await getUserProfile(requestedByUserId);
    if (!requesterProfile) {
      return { success: false, message: "Requester profile not found." };
    }

    const passengerProfile = await getUserProfile(passengerUserId);
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

    // 2. Fetch the ActiveRyd document
    const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
    const activeRydDocSnap = await activeRydDocRef.get();

    if (!activeRydDocSnap.exists) {
      return { success: false, message: "The selected ryd offer does not exist." };
    }
    const activeRydData = activeRydDocSnap.data() as ActiveRyd;

    // 3. Validations for ActiveRyd
    const joinableRydStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
    if (!joinableRydStatuses.includes(activeRydData.status)) {
      return { success: false, message: `This ryd is no longer accepting new passengers (Status: ${activeRydData.status}).` };
    }

    const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
    const activePassengersCount = activeRydData.passengerManifest.filter(p =>
        p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
        p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
        p.status !== PassengerManifestStatus.MISSED_PICKUP
    ).length;

    if (activePassengersCount >= passengerCapacity) {
      return { success: false, message: "This ryd is already full." };
    }

    const existingPassengerEntry = activeRydData.passengerManifest.find(
      p => p.userId === passengerUserId &&
           p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
           p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
    );
    if (existingPassengerEntry) {
      return { success: false, message: `${passengerProfile.fullName} is already on this ryd or has a pending request.` };
    }

    // 4. Check for an existing open RydData request for the same event by the passenger
    if (activeRydData.associatedEventId) {
      const existingRydRequestsQuery = db.collection('rydz')
        .where('passengerIds', 'array-contains', passengerUserId)
        .where('eventId', '==', activeRydData.associatedEventId)
        .where('status', 'in', ['requested', 'searching_driver'] as RydStatus[]); // Open statuses

      const existingRydRequestsSnap = await existingRydRequestsQuery.get();

      if (!existingRydRequestsSnap.empty) {
        const existingRydRequestDoc = existingRydRequestsSnap.docs[0]; // Take the first one found
        originalRydRequestIdForManifest = existingRydRequestDoc.id;
        console.log(`[Action: requestToJoinActiveRydAction] Found existing RydData request ${originalRydRequestIdForManifest} for passenger ${passengerUserId} and event ${activeRydData.associatedEventId}.`);
        
        // Add update for this existing RydData to the batch
        const existingRydRequestDocRef = db.collection('rydz').doc(originalRydRequestIdForManifest);
        batch.update(existingRydRequestDocRef, {
          status: 'driver_assigned' as RydStatus,
          driverId: activeRydData.driverId,
          assignedActiveRydId: activeRydId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[Action: requestToJoinActiveRydAction] Added update for RydData ${originalRydRequestIdForManifest} to batch.`);
      } else {
        console.log(`[Action: requestToJoinActiveRydAction] No existing open RydData request found for passenger ${passengerUserId} and event ${activeRydData.associatedEventId}.`);
      }
    }

    // 5. Prepare new passenger manifest item
    const passengerPickupStreet = passengerProfile.address?.street || "";
    const passengerPickupCity = passengerProfile.address?.city || "";
    const passengerPickupState = passengerProfile.address?.state || "";
    const passengerPickupZip = passengerProfile.address?.zip || "";

    let fullPickupAddress = [passengerPickupStreet, passengerPickupCity, passengerPickupState, passengerPickupZip].filter(Boolean).join(", ");
    if (fullPickupAddress.trim() === "") {
        fullPickupAddress = "Pickup to be coordinated"; // Default if no address in profile
    }

    const newManifestItemBase: Omit<PassengerManifestItem, 'originalRydRequestId'> = {
      userId: passengerUserId,
      pickupAddress: fullPickupAddress, 
      destinationAddress: activeRydData.finalDestinationAddress || "Event Destination",
      status: PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
      requestedAt: Timestamp.now(),
    };

    let newManifestItem: PassengerManifestItem;
    if (originalRydRequestIdForManifest) {
        newManifestItem = {
            ...newManifestItemBase,
            originalRydRequestId: originalRydRequestIdForManifest,
        };
    } else {
        newManifestItem = newManifestItemBase as PassengerManifestItem; // Type assertion
    }


    // 6. Add update for ActiveRyd manifest to the batch
    batch.update(activeRydDocRef, {
      passengerManifest: FieldValue.arrayUnion(newManifestItem),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: requestToJoinActiveRydAction] Added update for ActiveRyd ${activeRydId} passengerManifest to batch.`);
    
    // 7. Commit the batch
    await batch.commit();
    console.log(`[Action: requestToJoinActiveRydAction] Batch commit successful.`);

    let successMessage = `${passengerProfile.fullName}'s request to join the ryd has been sent to the driver for approval.`;
    if (originalRydRequestIdForManifest) {
        successMessage = `${passengerProfile.fullName}'s request to join has been sent. Your existing ryd request for this event has also been updated to link with this driver's offer.`;
    }
    
    console.log("[Action: requestToJoinActiveRydAction] Successfully processed join request for rydId:", activeRydId);
    return {
        success: true,
        message: successMessage,
        rydId: activeRydId,
    };

  } catch (error: any) {
    console.error("[Action: requestToJoinActiveRydAction] Error processing request:", error);
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
  actingUserId: string; // UID of the driver performing the action
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
    const activeRydDocSnap = await activeRydDocRef.get();
    if (!activeRydDocSnap.exists) {
      return { success: false, message: "ActiveRyd not found." };
    }
    const activeRydData = activeRydDocSnap.data() as ActiveRyd;

    // Verify the acting user is the driver
    if (activeRydData.driverId !== actingUserId) {
      return { success: false, message: "Unauthorized: Only the driver can manage join requests." };
    }

    const passengerIndex = activeRydData.passengerManifest.findIndex(
      (p) => p.userId === passengerUserId && p.status === PassengerManifestStatus.PENDING_DRIVER_APPROVAL
    );

    if (passengerIndex === -1) {
      return { success: false, message: "Passenger request not found or not in pending state." };
    }

    const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];
    const passengerProfile = await getUserProfile(passengerUserId);
    const passengerName = passengerProfile?.fullName || `User ${passengerUserId.substring(0,6)}`;

    if (newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER) {
      const passengerCapacity = parseInt(activeRydData.vehicleDetails?.passengerCapacity || "0", 10);
      const confirmedPassengersCount = activeRydData.passengerManifest.filter(
        p => p.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER || p.status === PassengerManifestStatus.AWAITING_PICKUP || p.status === PassengerManifestStatus.ON_BOARD
      ).length;

      if (confirmedPassengersCount >= passengerCapacity) {
        return { success: false, message: `Cannot approve ${passengerName}: Ryd is already full.` };
      }
      passengerToUpdate.status = PassengerManifestStatus.CONFIRMED_BY_DRIVER;
    } else if (newStatus === PassengerManifestStatus.REJECTED_BY_DRIVER) {
      passengerToUpdate.status = PassengerManifestStatus.REJECTED_BY_DRIVER;
    } else {
      return { success: false, message: "Invalid status update." }; 
    }

    const updatedManifest = [...activeRydData.passengerManifest];
    updatedManifest[passengerIndex] = passengerToUpdate;

    await activeRydDocRef.update({
      passengerManifest: updatedManifest,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const actionVerb = newStatus === PassengerManifestStatus.CONFIRMED_BY_DRIVER ? "approved" : "rejected";
    console.log(`[Action: managePassengerJoinRequestAction] Successfully ${actionVerb} passenger ${passengerName} for rydId: ${activeRydId}`);
    return { success: true, message: `Passenger ${passengerName}'s request has been ${actionVerb}.` };

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
  cancellingUserId: string; // UID of the user performing the action
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
    const activeRydDocSnap = await activeRydDocRef.get();
    if (!activeRydDocSnap.exists) {
      return { success: false, message: "ActiveRyd not found." };
    }
    const activeRydData = activeRydDocSnap.data() as ActiveRyd;

    // --- Authorization Check ---
    const cancellingUserProfile = await getUserProfile(cancellingUserId);
    if (!cancellingUserProfile) {
      return { success: false, message: "Your user profile could not be found, so we cannot authorize this action." };
    }
    
    const isCancellingForSelf = cancellingUserId === passengerUserIdToCancel;
    const isParentCancellingForStudent = 
        !isCancellingForSelf &&
        cancellingUserProfile.role === 'parent' &&
        cancellingUserProfile.managedStudentIds?.includes(passengerUserIdToCancel);

    if (!isCancellingForSelf && !isParentCancellingForStudent) {
        return { success: false, message: "Unauthorized: You do not have permission to cancel this spot." };
    }
    
    // --- Data Validation ---
    const passengerIndex = activeRydData.passengerManifest.findIndex(p => p.userId === passengerUserIdToCancel);
    if (passengerIndex === -1) {
      return { success: false, message: "Passenger not found on this ryd." };
    }

    const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];
    const passengerProfile = await getUserProfile(passengerUserIdToCancel); 
    const passengerName = passengerProfile?.fullName || `User ${passengerUserIdToCancel.substring(0,6)}`;

    // --- Status Validation ---
    const cancellablePassengerStatuses = [
      PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
      PassengerManifestStatus.CONFIRMED_BY_DRIVER,
      PassengerManifestStatus.AWAITING_PICKUP,
    ];
    if (!cancellablePassengerStatuses.includes(passengerToUpdate.status)) {
      return { success: false, message: `${passengerName} cannot cancel at this stage (Current Status: ${passengerToUpdate.status.replace(/_/g, ' ')}).` };
    }

    const nonCancellableRydStatuses = [
      ARStatus.COMPLETED,
      ARStatus.CANCELLED_BY_DRIVER,
      ARStatus.CANCELLED_BY_SYSTEM,
      ARStatus.IN_PROGRESS_ROUTE, 
      ARStatus.IN_PROGRESS_PICKUP 
    ];
    if (nonCancellableRydStatuses.includes(activeRydData.status)) {
      return { success: false, message: `This ryd cannot be cancelled by a passenger at this stage (Ryd Status: ${activeRydData.status.replace(/_/g, ' ')}).` };
    }

    // --- Update Logic ---
    const updatedManifest = [...activeRydData.passengerManifest];
    updatedManifest[passengerIndex].status = PassengerManifestStatus.CANCELLED_BY_PASSENGER;

    await activeRydDocRef.update({
      passengerManifest: updatedManifest,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Action: cancelPassengerSpotAction] Successfully cancelled spot for passenger ${passengerName} on rydId: ${activeRydId}`);
    return { success: true, message: `Spot for ${passengerName} on the ryd has been successfully cancelled.` };

  } catch (error: any) {
    console.error("[Action: cancelPassengerSpotAction] Error processing request:", error);
    return {
        success: false,
        message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
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
    const activeRydDocSnap = await activeRydDocRef.get();
    if (!activeRydDocSnap.exists) {
      return { success: false, message: "ActiveRyd not found." };
    }
    const activeRydData = activeRydDocSnap.data() as ActiveRyd;

    const passengerIndex = activeRydData.passengerManifest.findIndex(
      (p) => p.userId === passengerUserId
    );

    if (passengerIndex === -1) {
      return { success: false, message: "You are not listed as a passenger on this ryd, or your request was removed." };
    }

    const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];

    passengerToUpdate.pickupAddress = pickupLocation;
    passengerToUpdate.notes = notes || "";

    const [hours, minutes] = earliestPickupTimeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return { success: false, message: "Invalid earliest pickup time format."};
    }
    const pickupDateTime = new Date(eventDate); 
    pickupDateTime.setHours(hours, minutes, 0, 0); 
    passengerToUpdate.earliestPickupTimestamp = Timestamp.fromDate(pickupDateTime);

    const updatedManifest = [...activeRydData.passengerManifest];
    updatedManifest[passengerIndex] = passengerToUpdate;

    await activeRydDocRef.update({
      passengerManifest: updatedManifest,
      updatedAt: FieldValue.serverTimestamp(),
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
    const rydRequestSnap = await rydRequestDocRef.get();
    if (!rydRequestSnap.exists) {
      return { success: false, message: "Ryd request not found." };
    }
    const rydRequestData = rydRequestSnap.data() as RydData;

    // Verify the user is the original requester
    if (rydRequestData.requestedBy !== cancellingUserId) {
      // Additional check: If parent, are they managing one of the passengerIds?
      // For now, keeping it simple: only original requester can cancel.
      return { success: false, message: "Unauthorized: Only the original requester can cancel this ryd request." };
    }

    // Check if the ryd request is in a cancellable state
    const cancellableStatuses: RydStatus[] = ['requested', 'searching_driver'];
    if (!cancellableStatuses.includes(rydRequestData.status)) {
      return { success: false, message: `This ryd request cannot be cancelled at this stage (Status: ${rydRequestData.status.replace(/_/g, ' ')}).` };
    }

    // Update the status to 'cancelled_by_user'
    await rydRequestDocRef.update({
      status: 'cancelled_by_user' as RydStatus,
      updatedAt: FieldValue.serverTimestamp(),
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
    