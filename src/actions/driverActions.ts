
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ActiveRyd, UserProfileData, NotificationType } from '@/types';
import { ActiveRydStatus as ARStatus, PassengerManifestStatus, NotificationType as NotificationTypeEnum } from '@/types';
import { createNotification } from './notificationActions';

const db = admin.firestore();

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
    return handleActionError(error, "confirmRydPlanAction");
  }
}

export async function startRydAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: startRydAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;
  
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    const transactionResult = await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");

      const activeRydData = activeRydDocSnap.data() as ActiveRyd;
      if (activeRydData.driverId !== driverUserId) throw new Error("Unauthorized: You are not the driver.");
      if (activeRydData.status !== ARStatus.RYD_PLANNED) throw new Error(`Ryd cannot be started. Current status: ${activeRydData.status}.`);
      
      if (!activeRydData.proposedDepartureTime) throw new Error("Cannot start ryd without a proposed departure time.");

      const twoHoursBefore = new Timestamp(activeRydData.proposedDepartureTime.seconds - (2 * 60 * 60), activeRydData.proposedDepartureTime.nanoseconds);
      if (Timestamp.now() < twoHoursBefore) throw new Error("Ryd cannot be started more than 2 hours before proposed departure time.");

      transaction.update(activeRydDocRef, {
        status: ARStatus.IN_PROGRESS_PICKUP,
        actualDepartureTime: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      const passengerIds = activeRydData.passengerManifest
        .filter(p => p.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER)
        .map(p => p.userId);

      return {
        passengerIds,
        eventName: activeRydData.eventName
      }
    });

    const driverProfile = await getUserProfile(driverUserId);
    for (const passengerId of transactionResult.passengerIds) {
      await createNotification(
        passengerId,
        'Your Ryd has Started!',
        `${driverProfile?.fullName || 'Your driver'} has started the ryd to "${transactionResult.eventName || 'the event'}" and is on their way.`,
        NotificationTypeEnum.INFO,
        `/rydz/tracking/${activeRydId}`
      );
    }

    return { success: true, message: "Ryd started! You are now in the pickup phase." };
  } catch (error: any) {
    return handleActionError(error, "startRydAction");
  }
}

export async function completeRydAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: completeRydAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;

  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  try {
    const transactionResult = await db.runTransaction(async (transaction) => {
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

      const passengerIds = activeRydData.passengerManifest
        .filter(p => p.status === PassengerManifestStatus.ON_BOARD || p.status === PassengerManifestStatus.DROPPED_OFF)
        .map(p => p.userId);
      return { passengerIds, eventName: activeRydData.eventName };
    });

    const driverProfile = await getUserProfile(driverUserId);
    for (const passengerId of transactionResult.passengerIds) {
      await createNotification(
        passengerId,
        'Ryd Completed!',
        `Your ryd to "${transactionResult.eventName || 'the event'}" is complete. Please rate your driver, ${driverProfile?.fullName || 'the driver'}.`,
        NotificationTypeEnum.SUCCESS,
        `/drivers/${driverUserId}/rate`
      );
    }

    return { success: true, message: "Ryd marked as completed!" };
  } catch (error: any) {
    return handleActionError(error, "completeRydAction");
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
    const transactionResult = await db.runTransaction(async (transaction) => {
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
      
      const passengerIds = activeRydData.passengerManifest
        .filter(p => p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER && p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER)
        .map(p => p.userId);

      return { passengerIds, eventName: activeRydData.eventName };
    });

    const driverProfile = await getUserProfile(driverUserId);
    for (const passengerId of transactionResult.passengerIds) {
      await createNotification(
        passengerId,
        'Ryd Cancelled by Driver',
        `The ryd to "${transactionResult.eventName || 'the event'}" by ${driverProfile?.fullName || 'the driver'} has been cancelled. Please make other arrangements.`,
        NotificationTypeEnum.ERROR,
        `/rydz/upcoming`
      );
    }

    console.log(`[Action: cancelRydByDriverAction] Successfully cancelled rydId: ${activeRydId}`);
    return { success: true, message: "The ryd has been successfully cancelled. All passengers will be notified." };

  } catch (error: any) {
    return handleActionError(error, "cancelRydByDriverAction");
  }
}

export async function revertToPlanningAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: revertToPlanningAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      if (activeRydData.driverId !== driverUserId) throw new Error("Unauthorized: You are not the driver.");
      if (activeRydData.status !== ARStatus.RYD_PLANNED) throw new Error(`Ryd cannot be reverted. Current status is: ${activeRydData.status}.`);

      transaction.update(activeRydDocRef, {
        status: ARStatus.PLANNING,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: "Ryd has been unlocked and returned to planning status." };
  } catch (error: any) {
    return handleActionError(error, "revertToPlanningAction");
  }
}

export async function revertToRydPlannedAction(
  input: DriverActionInput
): Promise<{ success: boolean; message: string }> {
  console.log("[Action: revertToRydPlannedAction] Called with input:", input);
  const { activeRydId, driverUserId } = input;
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);

  try {
    await db.runTransaction(async (transaction) => {
      const activeRydDocSnap = await transaction.get(activeRydDocRef);
      if (!activeRydDocSnap.exists) throw new Error("ActiveRyd not found.");
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      if (activeRydData.driverId !== driverUserId) throw new Error("Unauthorized: You are not the driver.");
      if (activeRydData.status !== ARStatus.IN_PROGRESS_PICKUP) throw new Error(`Ryd cannot be reverted. Current status is: ${activeRydData.status}.`);

      transaction.update(activeRydDocRef, {
        status: ARStatus.RYD_PLANNED,
        actualDepartureTime: FieldValue.delete(), // Remove the start time
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: "Ryd has been paused and returned to the planned state." };
  } catch (error: any) {
    return handleActionError(error, "revertToRydPlannedAction");
  }
}
