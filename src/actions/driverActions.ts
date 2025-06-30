
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ActiveRyd, UserProfileData } from '@/types';
import { ActiveRydStatus as ARStatus, PassengerManifestStatus } from '@/types';

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
      message: error.message || `An unexpected error occurred with the database transaction.`
    };
  }
}

export async function startRydAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: startRydAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;
  
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");

      const activeRydData = activeRydDocSnap.data() as ActiveRyd;
      if (activeRydData.driverId !== driverUserId) throw new Error("Unauthorized: You are not the driver.");
      if (activeRydData.status !== ARStatus.RYD_PLANNED) throw new Error(`Ryd cannot be started. Current status: ${activeRydData.status}.`);

      const twoHoursBefore = new Timestamp(activeRydData.proposedDepartureTime.seconds - (2 * 60 * 60), activeRydData.proposedDepartureTime.nanoseconds);
      if (Timestamp.now() < twoHoursBefore) throw new Error("Ryd cannot be started more than 2 hours before proposed departure time.");

      transaction.update(activeRydDocRef, {
        status: ARStatus.IN_PROGRESS_PICKUP,
        actualDepartureTime: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: "Ryd started! You are now in the pickup phase." };
  } catch (error: any) {
    console.error("[Action: startRydAction] Error:", error);
    return { success: false, message: error.message || "An unknown error occurred." };
  }
}

export async function completeRydAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: completeRydAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");

      const activeRydData = activeRydDocSnap.data() as ActiveRyd;
      if (activeRydData.driverId !== driverUserId) throw new Error("Unauthorized: You are not the driver.");
      if (activeRydData.status !== ARStatus.IN_PROGRESS_ROUTE) throw new Error(`Ryd cannot be completed yet. Current status: ${activeRydData.status}.`);

      const updatedManifest = activeRydData.passengerManifest.map(p => ({
        ...p,
        status: p.status === PassengerManifestStatus.ON_BOARD ? PassengerManifestStatus.DROPPED_OFF : p.status,
      }));

      transaction.update(activeRydDocRef, {
        status: ARStatus.COMPLETED,
        passengerManifest: updatedManifest,
        estimatedCompletionTime: FieldValue.serverTimestamp(), // Using this field for actual completion
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { success: true, message: "Ryd marked as completed!" };
  } catch (error: any) {
    console.error("[Action: completeRydAction] Error:", error);
    return { success: false, message: error.message || "An unknown error occurred." };
  }
}

export async function cancelRydByDriverAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: cancelRydByDriverAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;

  if (!activeRydId || !driverUserId) {
    return { success: false, message: "Missing required IDs." };
  }

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) {
        throw new Error("ActiveRyd not found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      if (activeRydData.driverId !== driverUserId) {
        throw new Error("Unauthorized: You are not the driver of this ryd.");
      }

      const nonCancellableStatuses: ARStatus[] = [
        ARStatus.COMPLETED,
        ARStatus.CANCELLED_BY_DRIVER,
        ARStatus.CANCELLED_BY_SYSTEM,
      ];
      if (nonCancellableStatuses.includes(activeRydData.status)) {
        throw new Error(`This ryd cannot be cancelled at this stage. Current status: ${activeRydData.status.replace(/_/g, ' ')}`);
      }

      transaction.update(activeRydDocRef, {
        status: ARStatus.CANCELLED_BY_DRIVER,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Action: cancelRydByDriverAction] Successfully cancelled rydId: ${activeRydId}`);
    return { success: true, message: "The ryd has been successfully cancelled. All passengers will be notified." };

  } catch (error: any) {
    console.error("[Action: cancelRydByDriverAction] Error processing request:", error);
    return {
      success: false,
      message: error.message || `An unexpected error occurred while cancelling the ryd.`
    };
  }
}
