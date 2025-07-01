
'use server';

import admin from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { type ActiveRyd, type EventData, EventStatus } from '@/types';
import { ActiveRydStatus as ARStatus } from '@/types';

const db = admin.firestore();

// This action is designed to be called as a "lazy cron" from a high-traffic page.
export async function updateStaleRydzAction(): Promise<{ success: boolean; message: string; updatedCount: number }> {
  console.log('[Action: updateStaleRydzAction] Running job to update stale rydz.');

  const now = Timestamp.now();
  const fortyEightHoursAgo = new Timestamp(now.seconds - (48 * 60 * 60), now.nanoseconds);

  try {
    const staleRydzQuery = db.collection('activeRydz')
      .where('plannedArrivalTime', '<', fortyEightHoursAgo)
      .where('status', 'in', [
        ARStatus.PLANNING,
        ARStatus.AWAITING_PASSENGERS,
        ARStatus.RYD_PLANNED,
        ARStatus.IN_PROGRESS_PICKUP,
        ARStatus.IN_PROGRESS_ROUTE,
      ]);

    const snapshot = await staleRydzQuery.get();

    if (snapshot.empty) {
      const message = "No stale rydz found to update.";
      return { success: true, message, updatedCount: 0 };
    }

    const batch = db.batch();
    let updatedCount = 0;

    snapshot.forEach(doc => {
      const ryd = doc.data() as ActiveRyd;
      const rydRef = doc.ref;
      let newStatus: ARStatus | null = null;

      const inProgressStatuses = [ARStatus.IN_PROGRESS_PICKUP, ARStatus.IN_PROGRESS_ROUTE];
      const planningStatuses = [ARStatus.AWAITING_PASSENGERS, ARStatus.PLANNING, ARStatus.RYD_PLANNED];

      if (inProgressStatuses.includes(ryd.status)) {
        newStatus = ARStatus.COMPLETED;
      } else if (planningStatuses.includes(ryd.status)) {
        newStatus = ARStatus.CANCELLED_BY_SYSTEM;
      }

      if (newStatus) {
        batch.update(rydRef, { status: newStatus, updatedAt: FieldValue.serverTimestamp() });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
        await batch.commit();
    }

    const successMessage = `Successfully processed stale rydz check. Updated ${updatedCount} rydz.`;
    return { success: true, message: successMessage, updatedCount };

  } catch (error: any) {
    console.error('[Action: updateStaleRydzAction] Error processing stale rydz:', error);
    // Updated condition to check for error code 5 (NOT_FOUND) which often indicates a missing index.
    if (error.code === 5 || (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("missing a composite index")))) {
      const detailedError = "A Firestore index is required for the stale rydz query. Please check the browser's console for a link to create it.";
      return { success: false, message: detailedError, updatedCount: 0 };
    }
    if (error.message && (error.message.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED' || (typeof error.details === 'string' && error.details.includes('Could not refresh access token')))) {
       return {
        success: false,
        message: `A server authentication or timeout error occurred while checking for stale rydz. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`,
        updatedCount: 0,
       };
    }
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || "Unknown server error"}`,
      updatedCount: 0,
    };
  }
}

export async function updateStaleEventsAction(): Promise<{ success: boolean; message: string; updatedCount: number }> {
  console.log('[Action: updateStaleEventsAction] Running job to update stale events.');

  const now = Timestamp.now();
  const fortyEightHoursAgo = new Timestamp(now.seconds - (48 * 60 * 60), now.nanoseconds);

  try {
    // Fetch all events that are older than 48 hours.
    // We will filter by status in the code, as Firestore's `not-in`
    // does not match documents where the field is missing.
    const staleEventsQuery = db.collection('events')
      .where('eventTimestamp', '<', fortyEightHoursAgo);

    const snapshot = await staleEventsQuery.get();

    if (snapshot.empty) {
      const message = "No potentially stale events found to check.";
      return { success: true, message, updatedCount: 0 };
    }

    const batch = db.batch();
    let updatedCount = 0;

    snapshot.forEach(doc => {
      const event = doc.data() as EventData;
      // Filter here: only update if status is not already completed or cancelled.
      // This correctly handles events where `status` is undefined or 'active'.
      if (event.status !== EventStatus.COMPLETED && event.status !== EventStatus.CANCELLED) {
        batch.update(doc.ref, { status: EventStatus.COMPLETED, updatedAt: FieldValue.serverTimestamp() });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }

    const successMessage = `Successfully processed stale events check. Found ${snapshot.size} candidates and updated ${updatedCount} events to completed.`;
    return { success: true, message: successMessage, updatedCount };

  } catch (error: any) {
    console.error('[Action: updateStaleEventsAction] Error processing stale events:', error);
    // Updated condition to check for error code 5 (NOT_FOUND) which often indicates a missing index.
    if (error.code === 5 || (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("missing a composite index")))) {
      const detailedError = "A Firestore index is required for the stale events query. Please check the browser's console for a link to create it.";
      return { success: false, message: detailedError, updatedCount: 0 };
    }
     if (error.message && (error.message.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED' || (typeof error.details === 'string' && error.details.includes('Could not refresh access token')))) {
       return {
        success: false,
        message: `A server authentication or timeout error occurred while checking for stale events. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`,
        updatedCount: 0,
       };
    }
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || "Unknown server error"}`,
      updatedCount: 0,
    };
  }
}
