
'use server';

import admin from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { type ActiveRyd, type EventData, EventStatus } from '@/types';
import { ActiveRydStatus as ARStatus } from '@/types';

const db = admin.firestore();

// A robust, centralized error handler for server actions.
const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";
    
    // Handle Firestore index errors
    if (error.code === 5 || error.code === 'failed-precondition' || (errorMessage.toLowerCase().includes("index") || errorMessage.toLowerCase().includes("missing a composite index"))) {
      return { success: false, message: `A Firestore index is required for this query. Please check your server terminal logs for an error message from Firestore that contains a link to create the necessary index automatically.` };
    }
    
    // Handle Authentication/Network errors
    if (errorMessage.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED' || (typeof error.details === 'string' && error.details.includes('Could not refresh access token'))) {
       return {
        success: false,
        message: `A server authentication or timeout error occurred during '${actionName}'. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`,
       };
    }

    // Default fallback for any other unexpected errors
    return { success: false, message: `An unexpected error occurred in ${actionName}: ${errorMessage}` };
};


// This action is designed to be called as a "lazy cron" from a high-traffic page.
export async function updateStaleRydzAction(): Promise<{ success: boolean; message: string; updatedRydz: number }> {
  console.log('[Action: updateStaleRydzAction] Running job to update stale rydz not linked to events.');

  const now = Timestamp.now();
  const fortyEightHoursAgo = new Timestamp(now.seconds - (48 * 60 * 60), now.nanoseconds);

  const statusesToUpdate: ARStatus[] = [
    ARStatus.PLANNING,
    ARStatus.AWAITING_PASSENGERS,
    ARStatus.RYD_PLANNED,
    ARStatus.IN_PROGRESS_PICKUP,
    ARStatus.IN_PROGRESS_ROUTE,
  ];

  try {
    // Query on status only to avoid complex index, then filter by date in code.
    const staleRydzQuery = db.collection('activeRydz')
      .where('status', 'in', statusesToUpdate);

    const snapshot = await staleRydzQuery.get();

    if (snapshot.empty) {
      const message = "No active-status non-event rydz found to process.";
      return { success: true, message, updatedRydz: 0 };
    }

    const batch = db.batch();
    let updatedCount = 0;

    snapshot.docs.forEach(doc => {
      const ryd = doc.data() as ActiveRyd;
      
      // Filter in code: only affect rydz without an associated event AND where planned time is past the stale threshold.
      if (!ryd.associatedEventId && ryd.plannedArrivalTime && ryd.plannedArrivalTime.toMillis() < fortyEightHoursAgo.toMillis()) {
        let newStatus: ARStatus | null = null;
        const inProgressStatuses = [ARStatus.IN_PROGRESS_PICKUP, ARStatus.IN_PROGRESS_ROUTE, ARStatus.RYD_PLANNED];
        const planningStatuses = [ARStatus.AWAITING_PASSENGERS, ARStatus.PLANNING];

        if (inProgressStatuses.includes(ryd.status)) {
          newStatus = ARStatus.COMPLETED;
        } else if (planningStatuses.includes(ryd.status)) {
          newStatus = ARStatus.CANCELLED_BY_SYSTEM;
        }

        if (newStatus) {
          batch.update(doc.ref, { status: newStatus, updatedAt: FieldValue.serverTimestamp() });
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
        await batch.commit();
    }

    const successMessage = `Successfully processed stale rydz check. Updated ${updatedCount} non-event rydz.`;
    return { success: true, message: successMessage, updatedRydz: updatedCount };

  } catch (error: any) {
    const { message } = handleActionError(error, "updateStaleRydzAction");
    return { success: false, message, updatedRydz: 0 };
  }
}

export async function updateStaleEventsAction(): Promise<{ success: boolean; message: string; updatedEvents: number; updatedRydz: number; }> {
  console.log('[Action: updateStaleEventsAction] Running job to update stale events and their associated rydz.');

  const now = Timestamp.now();
  const fortyEightHoursAgo = new Timestamp(now.seconds - (48 * 60 * 60), now.nanoseconds);

  try {
    // Simplified query on status only to avoid composite index. Filter timestamp in code.
    const staleEventsQuery = db.collection('events')
      .where('status', '==', EventStatus.ACTIVE);

    console.log(`[Action: updateStaleEventsAction] Checking for stale events older than ${fortyEightHoursAgo.toDate().toISOString()}.`)

    const eventsSnapshot = await staleEventsQuery.get();

    if (eventsSnapshot.empty) {
      console.log(`[Action: updateStaleEventsAction] No active events found to process.`)
      return { success: true, message: "No active events found to process.", updatedEvents: 0, updatedRydz: 0 };
    }

    console.log(`[Action: updateStaleEventsAction] Found ${eventsSnapshot.docs.length} active events to process.`);
    
    const docsToProcess = eventsSnapshot.docs.filter(doc => {
      const eventTimestamp = doc.data().eventTimestamp as Timestamp;
      // Add a check to ensure eventTimestamp is a valid Firestore Timestamp object
      if (eventTimestamp && typeof eventTimestamp.toMillis === 'function') {
        return eventTimestamp.toMillis() < fortyEightHoursAgo.toMillis();
      }
      // If the timestamp is missing or not the correct type, don't process it as stale.
      return false;
    });

    console.log(`[Action: updateStaleEventsAction] Found ${docsToProcess.length} stale events to process.`);

    if (docsToProcess.length === 0) {
      return { success: true, message: "No stale active events found to update.", updatedEvents: 0, updatedRydz: 0 };
    }

    let updatedEventsCount = 0;
    let updatedRydzCount = 0;
    const batch = db.batch();
    const activeRydzCollectionRef = db.collection('activeRydz');
    const unresolvedRydStatuses = [
        ARStatus.PLANNING,
        ARStatus.AWAITING_PASSENGERS,
        ARStatus.RYD_PLANNED,
        ARStatus.IN_PROGRESS_PICKUP,
        ARStatus.IN_PROGRESS_ROUTE,
    ];

    for (const eventDoc of docsToProcess) {
      const eventId = eventDoc.id;
      
      // Mark the event as completed
      batch.update(eventDoc.ref, { status: EventStatus.COMPLETED, updatedAt: FieldValue.serverTimestamp() });
      updatedEventsCount++;

      // Find associated rydz with a simple query, then filter in code to avoid composite index.
      const associatedRydzQuery = activeRydzCollectionRef
        .where('associatedEventId', '==', eventId);
        
      const rydzSnapshot = await associatedRydzQuery.get();
      
      const rydzToProcess = rydzSnapshot.docs.filter(doc => unresolvedRydStatuses.includes(doc.data().status));

      rydzToProcess.forEach(rydDoc => {
        const ryd = rydDoc.data() as ActiveRyd;
        let newStatus: ARStatus | null = null;
        
        const inProgressStatuses = [ARStatus.IN_PROGRESS_PICKUP, ARStatus.IN_PROGRESS_ROUTE, ARStatus.RYD_PLANNED];
        const planningStatuses = [ARStatus.AWAITING_PASSENGERS, ARStatus.PLANNING, ARStatus.RYD_PLANNED];
        
        if (inProgressStatuses.includes(ryd.status)) {
            newStatus = ARStatus.COMPLETED;
        } else if (planningStatuses.includes(ryd.status)) {
            newStatus = ARStatus.CANCELLED_BY_SYSTEM;
        }

        if (newStatus) {
            batch.update(rydDoc.ref, { status: newStatus, updatedAt: FieldValue.serverTimestamp() });
            updatedRydzCount++;
        }
      });
    }

    if (updatedEventsCount > 0 || updatedRydzCount > 0) {
      await batch.commit();
    }

    const successMessage = `Successfully processed stale events check. Updated ${updatedEventsCount} event(s) and ${updatedRydzCount} associated rydz.`;
    return { success: true, message: successMessage, updatedEvents: updatedEventsCount, updatedRydz: updatedRydzCount };

  } catch (error: any) {
    const { message } = handleActionError(error, "updateStaleEventsAction");
    return { success: false, message, updatedEvents: 0, updatedRydz: 0 };
  }
}
