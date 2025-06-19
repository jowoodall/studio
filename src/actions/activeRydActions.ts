
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
      if (requesterProfile.role !== 'parent') { // Assuming UserRole.PARENT is 'parent'
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

    // 3. Validations
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

    // 4. Prepare new passenger manifest item
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
      // originalRydRequestId: will be null for direct join, filled if driver fulfills a RydData
      pickupAddress: fullPickupAddress, // Default pickup, user will confirm/update in next step
      destinationAddress: activeRydData.finalDestinationAddress || "Event Destination",
      status: PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
      requestedAt: Timestamp.now(),
      // earliestPickupTimestamp will be set by the passenger in the next step
    };
    
    // Using FieldValue.arrayUnion to add the new item
    await activeRydDocRef.update({
      passengerManifest: FieldValue.arrayUnion(newManifestItem),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("[Action: requestToJoinActiveRydAction] Successfully added passenger to manifest for rydId:", activeRydId);
    return { 
        success: true, 
        message: `${passengerProfile.fullName}'s request to join the ryd has been sent to the driver for approval.`,
        rydId: activeRydId,
        // passengerManifestItemId: passengerUserId can be used to identify the item for subsequent updates if needed.
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
      // Optionally, set pickupOrder or other details here
    } else if (newStatus === PassengerManifestStatus.REJECTED_BY_DRIVER) {
      passengerToUpdate.status = PassengerManifestStatus.REJECTED_BY_DRIVER;
    } else {
      return { success: false, message: "Invalid status update." }; // Should not happen with current input type
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
    // 1. Fetch ActiveRyd
    const activeRydDocSnap = await activeRydDocRef.get();
    if (!activeRydDocSnap.exists) {
      return { success: false, message: "ActiveRyd not found." };
    }
    const activeRydData = activeRydDocSnap.data() as ActiveRyd;

    // 2. Authorization
    const cancellingUserProfile = await getUserProfile(cancellingUserId);
    if (!cancellingUserProfile) {
      return { success: false, message: "Cancelling user profile not found." };
    }

    if (cancellingUserId !== passengerUserIdToCancel) {
      if (cancellingUserProfile.role !== 'parent') { // Assuming UserRole.PARENT
        return { success: false, message: "Unauthorized: Only parents can cancel for other users." };
      }
      if (!cancellingUserProfile.managedStudentIds?.includes(passengerUserIdToCancel)) {
        return { success: false, message: "Unauthorized: You are not managing this student." };
      }
    }
    
    // 3. Find passenger in manifest and validate status
    const passengerIndex = activeRydData.passengerManifest.findIndex(
      (p) => p.userId === passengerUserIdToCancel
    );

    if (passengerIndex === -1) {
      return { success: false, message: "Passenger not found on this ryd." };
    }
    
    const passengerToUpdate = activeRydData.passengerManifest[passengerIndex];
    const passengerProfile = await getUserProfile(passengerUserIdToCancel); // For display name in message
    const passengerName = passengerProfile?.fullName || `User ${passengerUserIdToCancel.substring(0,6)}`;

    const cancellablePassengerStatuses: PassengerManifestStatus[] = [
      PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
      PassengerManifestStatus.CONFIRMED_BY_DRIVER,
      PassengerManifestStatus.AWAITING_PICKUP,
    ];
    const nonCancellableRydStatuses: ARStatus[] = [
      ARStatus.COMPLETED,
      ARStatus.CANCELLED_BY_DRIVER,
      ARStatus.CANCELLED_BY_SYSTEM,
      ARStatus.IN_PROGRESS_ROUTE, // Might be too late to cancel once en route
      ARStatus.IN_PROGRESS_PICKUP // Might be too late to cancel once pickup sequence started
    ];

    if (!cancellablePassengerStatuses.includes(passengerToUpdate.status)) {
      return { success: false, message: `${passengerName} cannot cancel at this stage (Current Status: ${passengerToUpdate.status.replace(/_/g, ' ')}).` };
    }
    if (nonCancellableRydStatuses.includes(activeRydData.status)) {
         return { success: false, message: `This ryd cannot be cancelled by passenger at this stage (Ryd Status: ${activeRydData.status.replace(/_/g, ' ')}).` };
    }

    // 4. Update passenger status
    passengerToUpdate.status = PassengerManifestStatus.CANCELLED_BY_PASSENGER;
    const updatedManifest = [...activeRydData.passengerManifest];
    updatedManifest[passengerIndex] = passengerToUpdate;

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
    // 1. Fetch RydRequestData
    const rydRequestRef = db.collection('rydz').doc(rydRequestId);
    const rydRequestSnap = await rydRequestRef.get();
    if (!rydRequestSnap.exists) {
      return { success: false, message: "Ryd request not found." };
    }
    const rydRequestData = rydRequestSnap.data() as RydData;

    // 2. Fetch ActiveRyd
    const activeRydRef = db.collection('activeRydz').doc(existingActiveRydId);
    const activeRydSnap = await activeRydRef.get();
    if (!activeRydSnap.exists) {
      return { success: false, message: "Existing ActiveRyd not found." };
    }
    const activeRydData = activeRydSnap.data() as ActiveRyd;

    // 3. Fetch Driver Profile (for verification)
    const driverProfile = await getUserProfile(driverUserId);
    if (!driverProfile) {
      // This should ideally not happen if driverUserId comes from an authenticated session
      return { success: false, message: "Driver profile not found." };
    }
    if (activeRydData.driverId !== driverUserId) {
      return { success: false, message: "Mismatch: You are not the driver of the selected ActiveRyd." };
    }
     if (!driverProfile.canDrive) {
      return { success: false, message: "You are not registered or permitted to drive." };
    }


    // 4. Validations
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

    // 5. Prepare new passenger manifest items for the ActiveRyd
    const newManifestItems: PassengerManifestItem[] = [];
    let eventNameForManifest = "Event Destination"; // Default
    if (activeRydData.associatedEventId) {
        const eventDocRef = db.collection('events').doc(activeRydData.associatedEventId);
        const eventDocSnap = await eventDocRef.get();
        if (eventDocSnap.exists) { 
            eventNameForManifest = (eventDocSnap.data() as EventData).name;
        }
    } else if (activeRydData.finalDestinationAddress) {
        eventNameForManifest = activeRydData.finalDestinationAddress;
    }


    for (const passengerId of rydRequestData.passengerIds) {
      const passengerProfileData = await getUserProfile(passengerId); // Renamed to avoid conflict
      let passengerPickupAddress = rydRequestData.pickupLocation || "Pickup to be coordinated"; // Default to request's pickup
      if (passengerProfileData?.address?.street) { // Override with passenger's profile address if available
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
        requestedAt: rydRequestData.createdAt || Timestamp.now(), // Use original request time or now
      });
    }

    // 6. Update ActiveRyd
    batch.update(activeRydRef, {
      passengerManifest: FieldValue.arrayUnion(...newManifestItems),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 7. Update RydRequestData
    batch.update(rydRequestRef, {
      status: 'driver_assigned' as RydStatus,
      driverId: driverUserId,
      assignedActiveRydId: existingActiveRydId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 8. Commit batch
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
  earliestPickupTimeStr: string; // e.g., "08:30"
  eventDate: Date; // The actual Date object for the event date (to combine with time)
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

    // Update details
    passengerToUpdate.pickupAddress = pickupLocation;
    passengerToUpdate.notes = notes || "";

    // Construct earliestPickupTimestamp
    const [hours, minutes] = earliestPickupTimeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return { success: false, message: "Invalid earliest pickup time format."};
    }
    const pickupDateTime = new Date(eventDate); // Start with the event date
    pickupDateTime.setHours(hours, minutes, 0, 0); // Set the time
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
