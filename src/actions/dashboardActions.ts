
'use server';

import admin from '@/lib/firebaseAdmin';
import type { DashboardRydData, ActiveRyd, UserProfileData, ScheduleItem, RydData, EventData } from '@/types';
import { UserRole, ActiveRydStatus, EventStatus } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, isWithinInterval, startOfDay } from 'date-fns';

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
    
    if (error.code === 'permission-denied') {
        return {
            success: false,
            message: `A Firestore security rule ('permission-denied') is blocking the server from fetching data for the '${actionName}' action. Please check your rules.`
        };
    }

    // Default fallback for any other unexpected errors
    return { success: false, message: `An unexpected error occurred in ${actionName}: ${errorMessage}` };
};


// --- Main Action ---

export async function getMyNextRydAction({ userId }: { userId: string }): Promise<{ success: boolean; ryd?: DashboardRydData | null; message?: string }> {
  console.log(`[DashboardAction] Fetching next ryd for user ${userId}.`);

  if (!userId) {
    return { success: false, message: "User ID is required." };
  }

  try {
    const userProfileSnap = await db.collection('users').doc(userId).get();
     if (!userProfileSnap.exists) {
      return { success: false, message: "User profile not found." };
    }
    const userProfile = userProfileSnap.data() as UserProfileData;

    const uidsToQuery = [userId];
    if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
        uidsToQuery.push(...userProfile.managedStudentIds);
    }

    const drivingQuery = db.collection('activeRydz').where('driverId', 'in', uidsToQuery);
    const passengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains-any', uidsToQuery);
    
    const [drivingSnap, passengerSnap] = await Promise.all([
        drivingQuery.get(),
        passengerQuery.get()
    ]);

    const allUserRydz: ActiveRyd[] = [];
    const rydIds = new Set<string>();

    drivingSnap.forEach(doc => {
        if(!rydIds.has(doc.id)) {
            allUserRydz.push({ id: doc.id, ...doc.data() } as ActiveRyd);
            rydIds.add(doc.id);
        }
    });
    passengerSnap.forEach(doc => {
         if(!rydIds.has(doc.id)) {
            allUserRydz.push({ id: doc.id, ...doc.data() } as ActiveRyd);
            rydIds.add(doc.id);
        }
    });

    const now = Timestamp.now();
    const upcomingStatuses: ActiveRydStatus[] = [
      ActiveRydStatus.PLANNING,
      ActiveRydStatus.AWAITING_PASSENGERS,
      ActiveRydStatus.RYD_PLANNED,
      ActiveRydStatus.IN_PROGRESS_PICKUP,
      ActiveRydStatus.IN_PROGRESS_ROUTE,
    ];
    
    const upcomingRydz = allUserRydz
        .filter(ryd => ryd.status && upcomingStatuses.includes(ryd.status))
        .filter(ryd => ryd.plannedArrivalTime && (ryd.plannedArrivalTime as Timestamp)?.toMillis() >= now.toMillis())
        .sort((a, b) => (a.plannedArrivalTime as Timestamp).toMillis() - (b.plannedArrivalTime as Timestamp).toMillis());


    if (upcomingRydz.length === 0) {
      return { success: true, ryd: null };
    }
    
    const nextRyd = upcomingRydz[0];
    const isDriver = uidsToQuery.includes(nextRyd.driverId);
    
    let rydFor = { name: 'Unknown User', relation: 'self' as const, uid: '' };

    if (isDriver) {
        const driverOfRyd = await db.collection('users').doc(nextRyd.driverId).get().then(snap => snap.data() as UserProfileData);
        rydFor = { name: driverOfRyd.fullName, relation: 'self', uid: driverOfRyd.uid };
    } else {
        const passengerUid = uidsToQuery.find(uid => nextRyd.passengerUids?.includes(uid));
        if (passengerUid) {
            const passengerOfRyd = await db.collection('users').doc(passengerUid).get().then(snap => snap.data() as UserProfileData);
            rydFor = { 
                name: passengerOfRyd.fullName, 
                relation: passengerUid === userId ? 'self' : 'student',
                uid: passengerUid
            };
        }
    }
    
    let driverProfileData: UserProfileData | undefined = undefined;
    if (nextRyd.driverId) {
        const driverSnap = await db.collection('users').doc(nextRyd.driverId).get();
        if (driverSnap.exists) driverProfileData = driverSnap.data() as UserProfileData;
    }
    
    const eventTime = nextRyd.plannedArrivalTime || nextRyd.proposedDepartureTime || now;

    const dashboardRyd: DashboardRydData = {
        id: nextRyd.id,
        rydFor,
        isDriver,
        eventName: nextRyd.eventName || "Unnamed Ryd",
        destination: nextRyd.finalDestinationAddress || "TBD",
        rydStatus: nextRyd.status,
        eventTimestamp: eventTime.toDate().toISOString(),
        driverName: driverProfileData?.fullName,
        driverId: nextRyd.driverId,
        passengerStatus: isDriver ? undefined : nextRyd.passengerManifest.find(p => p.userId === rydFor.uid)?.status,
    };
    
    return { success: true, ryd: dashboardRyd };

  } catch (error: any) {
    return handleActionError(error, "getMyNextRydAction");
  }
}

export async function getUpcomingScheduleAction({ userId }: { userId: string }): Promise<{ success: boolean; schedule?: ScheduleItem[]; message?: string; }> {
  console.log('[DashboardAction] Fetching upcoming schedule.');
  if (!userId) return { success: false, message: "User ID is required." };

  try {
    const userProfileSnap = await db.collection('users').doc(userId).get();
    if (!userProfileSnap.exists) return { success: false, message: "User profile not found." };
    const userProfile = userProfileSnap.data() as UserProfileData;

    const uidsToQuery = [userId];
    if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
      uidsToQuery.push(...userProfile.managedStudentIds);
    }

    const todayStart = startOfDay(new Date());
    const fourteenDaysLater = addDays(todayStart, 14);

    const scheduleItemsMap = new Map<string, ScheduleItem>();

    // Refactored Queries to be simpler and avoid composite index needs
    const activeRydzDriverQuery = db.collection('activeRydz').where('driverId', 'in', uidsToQuery);
    const activeRydzPassengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains-any', uidsToQuery);
    const rydRequestsQuery = db.collection('rydz').where('passengerIds', 'array-contains-any', uidsToQuery).where('status', 'in', ['requested', 'searching_driver']);
    const managedEventsQuery = db.collection('events').where('managerIds', 'array-contains', userId).where('status', '==', EventStatus.ACTIVE);
    
    const queriesToRun: Promise<admin.firestore.QuerySnapshot>[] = [
      activeRydzDriverQuery.get(),
      activeRydzPassengerQuery.get(),
      rydRequestsQuery.get(),
      managedEventsQuery.get(),
    ];

    if (userProfile.joinedGroupIds && userProfile.joinedGroupIds.length > 0) {
      const groupEventsQuery = db.collection('events').where('associatedGroupIds', 'array-contains-any', userProfile.joinedGroupIds).where('status', '==', EventStatus.ACTIVE);
      queriesToRun.push(groupEventsQuery.get());
    }

    const [
      activeRydzAsDriverSnap,
      activeRydzAsPassengerSnap,
      rydRequestsSnap,
      managedEventsSnap,
      groupEventsSnap, // Will be undefined if the query wasn't added, which is fine
    ] = await Promise.all(queriesToRun);
    
    const allActiveRydzDocs = [...activeRydzAsDriverSnap.docs, ...activeRydzAsPassengerSnap.docs];
    const allEventsDocs = [...managedEventsSnap.docs, ...(groupEventsSnap?.docs || [])];
    
    const allActiveRydz = allActiveRydzDocs.reduce((acc, doc) => {
        if (!acc.find(item => item.id === doc.id)) {
            acc.push({ id: doc.id, ...doc.data() } as ActiveRyd);
        }
        return acc;
    }, [] as ActiveRyd[]);
    
    // --- Process Active Rydz ---
    for (const activeRyd of allActiveRydz) {
      const timestamp = (activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime) as Timestamp | undefined;
      if (timestamp && isWithinInterval(timestamp.toDate(), { start: todayStart, end: fourteenDaysLater })) {
        const relevantUserUid = uidsToQuery.find(uid => uid === activeRyd.driverId || activeRyd.passengerUids?.includes(uid));
        
        // This check is important as passenger query might return rydz for other students not managed by this parent.
        if (!relevantUserUid) continue;

        const relevantUserSnap = await db.collection('users').doc(relevantUserUid).get();
        if(!relevantUserSnap.exists) continue;

        const relevantUser = relevantUserSnap.data() as UserProfileData;
        let subtitle: string;
        if (activeRyd.driverId === relevantUserUid) {
          subtitle = "You are driving";
        } else {
          subtitle = `Passenger: ${relevantUser.fullName}`;
        }
        
        scheduleItemsMap.set(`ryd-${activeRyd.id}`, {
          id: `ryd-${activeRyd.id}`,
          type: 'ryd',
          timestamp: timestamp.toDate().toISOString(),
          title: activeRyd.eventName || 'Unnamed Ryd',
          subtitle: subtitle,
          href: `/rydz/tracking/${activeRyd.id}`,
        });
      }
    }

    // --- Process Ryd Requests ---
    for (const reqDoc of rydRequestsSnap.docs) {
      const rydRequest = { id: reqDoc.id, ...reqDoc.data() } as RydData;
      const timestamp = rydRequest.rydTimestamp as Timestamp | undefined;
       if (timestamp && isWithinInterval(timestamp.toDate(), { start: todayStart, end: fourteenDaysLater })) {
        scheduleItemsMap.set(`request-${rydRequest.id}`, {
          id: `request-${rydRequest.id}`,
          type: 'request',
          timestamp: timestamp.toDate().toISOString(),
          title: rydRequest.eventName || rydRequest.destination,
          subtitle: 'Searching for driver',
          href: `/rydz/upcoming`,
        });
      }
    }

    // --- Process Events ---
    const allUniqueEvents = allEventsDocs.reduce((acc, doc) => {
        if (!acc.has(doc.id)) {
            acc.set(doc.id, {id: doc.id, ...doc.data()} as EventData);
        }
        return acc;
    }, new Map<string, EventData>());

    for (const event of allUniqueEvents.values()) {
        const timestamp = event.eventStartTimestamp as Timestamp | undefined;
        if (timestamp && isWithinInterval(timestamp.toDate(), { start: todayStart, end: fourteenDaysLater })) {
            scheduleItemsMap.set(`event-${event.id}`, {
                id: `event-${event.id}`,
                type: 'event',
                timestamp: timestamp.toDate().toISOString(),
                title: event.name,
                href: `/events/${event.id}/rydz`,
            });
        }
    }

    const finalSchedule = Array.from(scheduleItemsMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { success: true, schedule: finalSchedule };

  } catch (error: any) {
    return handleActionError(error, "getUpcomingScheduleAction");
  }
}
