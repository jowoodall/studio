'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ActiveRyd, UserProfileData } from '@/types';
import { ActiveRydStatus as ARStatus } from '@/types';

const db = admin.firestore();

interface DriverActionInput {
  activeRydId: string;
  driverUserId: string;
}

// Helper function to get user profile
async function getDriverProfile(userId: string): Promise<UserProfileData | null> {
  const userDocRef = db.collection('users').doc(userId);
  const userDocSnap = await userDocRef.get();
  if (!userDocSnap.exists || !(userDocSnap.data() as UserProfileData).canDrive) {
    return null;
  }
  return userDocSnap.data() as UserProfileData;
}


export async function confirmRydPlanAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: confirmRydPlanAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;

  if (!activeRydId || !driverUserId) {
    return { success: false, message: "Missing required IDs." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    const driverProfile = await getDriverProfile(driverUserId);
    if (!driverProfile) {
      return { success: false, message: "Action requires a valid, authorized driver profile." };
    }
    
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      // Authorization check within transaction
      if (activeRydData.driverId !== driverUserId) {
        throw new Error("Unauthorized: You are not the driver of this ryd.");
      }
      
      const allowedStatuses: ARStatus[] = [ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS];
      if (!allowedStatuses.includes(activeRydData.status)) {
          throw new Error(`This ryd cannot be confirmed at this stage. Current status: ${activeRydData.status.replace(/_/g, ' ')}`);
      }
      
      transaction.update(activeRydDocRef, {
        status: ARStatus.RYD_PLANNED,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Action: confirmRydPlanAction] Successfully confirmed plan for rydId: ${activeRydId}`);
    return { success: true, message: "The ryd plan has been confirmed. No more passengers can join." };

  } catch (error: any) {
    console.error("[Action: confirmRydPlanAction] Error processing request:", error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || "Unknown server error"}`
    };
  }
}
