
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

export async function confirmRydPlanAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: confirmRydPlanAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;

  if (!activeRydId || !driverUserId) {
    return { success: false, message: "Missing required IDs." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  const driverDocRef = db.collection('users').doc(driverUserId);

  try {
    await db.runTransaction(async (transaction) => {
      // Get both documents at the start of the transaction for consistency
      const [activeRydDocSnap, driverDocSnap] = await transaction.getAll(activeRydDocRef, driverDocRef);

      if (!driverDocSnap.exists) {
        throw new Error("Could not find your driver profile. Unable to authorize this action.");
      }
      const driverProfile = driverDocSnap.data() as UserProfileData;
      if (!driverProfile.canDrive) {
        throw new Error("Your profile does not permit you to drive.");
      }
      
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found. The ryd may have been deleted.");
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
    // Now, any error thrown within the transaction (including our custom ones) will be caught here.
    return {
      success: false,
      message: error.message || `An unexpected error occurred with the database transaction.`
    };
  }
}
