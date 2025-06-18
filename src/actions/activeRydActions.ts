
'use server';

import admin from '@/lib/firebaseAdmin'; // Using firebaseAdmin for server-side operations
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ActiveRyd, PassengerManifestItem, UserProfileData, UserRole} from '@/types';
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
      if (requesterProfile.role !== UserRole.PARENT) {
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
    const joinableStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
    if (!joinableStatuses.includes(activeRydData.status)) {
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
      // originalRydRequestId: can be added if linking to a RydData request
      pickupAddress: fullPickupAddress,
      destinationAddress: activeRydData.finalDestinationAddress || "Event Destination",
      status: PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
      requestedAt: Timestamp.now(),
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
        // passengerManifestItemId: We don't have an ID for the sub-item in arrayUnion directly
    };

  } catch (error: any) {
    console.error("[Action: requestToJoinActiveRydAction] Error processing request:", error);
    return { 
        success: false, 
        message: `An unexpected error occurred: ${error.message || "Unknown server error"}` 
    };
  }
}

