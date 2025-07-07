
'use server';

import admin from '@/lib/firebaseAdmin';
import type { DashboardRydData, ActiveRyd, UserProfileData } from '@/types';
import { UserRole, ActiveRydStatus, PassengerManifestStatus } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

// A robust, centralized error handler for server actions.
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

export async function getMyNextRydAction(userId: string): Promise<{ success: boolean; ryd?: DashboardRydData | null; message?: string }> {
  console.log(`[DashboardAction] Fetching next ryd for user: ${userId}`);
  if (!userId) {
    return { success: false, message: "User ID is required." };
  }

  try {
    const userProfileSnap = await db.collection('users').doc(userId).get();
    if (!userProfileSnap.exists) {
      return { success: false, message: "User profile not found." };
    }
    const userProfile = userProfileSnap.data() as UserProfileData;
    
    const now = Timestamp.now();
    const upcomingStatuses: ActiveRydStatus[] = [
      ActiveRydStatus.PLANNING,
      ActiveRydStatus.AWAITING_PASSENGERS,
      ActiveRydStatus.RYD_PLANNED,
      ActiveRydStatus.IN_PROGRESS_PICKUP,
      ActiveRydStatus.IN_PROGRESS_ROUTE,
    ];

    // Use simple, valid queries
    const drivingQuery = db.collection('activeRydz').where('driverId', '==', userId);
    const passengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains', userId);

    const [drivingSnap, passengerSnap] = await Promise.all([
      drivingQuery.get(),
      passengerQuery.get(),
    ]);
    
    // Combine and filter in code
    const allUserRydz: ActiveRyd[] = [];
    drivingSnap.forEach(doc => allUserRydz.push({ id: doc.id, ...doc.data() } as ActiveRyd));
    passengerSnap.forEach(doc => {
        // Avoid duplicates if user is passenger in their own ryd (edge case)
        if (!allUserRydz.some(r => r.id === doc.id)) {
            allUserRydz.push({ id: doc.id, ...doc.data() } as ActiveRyd);
        }
    });

    const upcomingRydz = allUserRydz
        .filter(ryd => upcomingStatuses.includes(ryd.status))
        .filter(ryd => (ryd.plannedArrivalTime as Timestamp)?.toMillis() >= now.toMillis())
        .sort((a, b) => (a.plannedArrivalTime as Timestamp).toMillis() - (b.plannedArrivalTime as Timestamp).toMillis());


    if (upcomingRydz.length === 0) {
      return { success: true, ryd: null };
    }
    
    const nextRyd = upcomingRydz[0];
    const isDriver = nextRyd.driverId === userId;
    
    // Determine which user this ryd is for (self or student)
    let rydFor = { name: userProfile.fullName, relation: 'self' as const, uid: userId };
    
    let driverProfile: UserProfileData | undefined = undefined;
    if (isDriver) {
        driverProfile = userProfile;
    } else if (nextRyd.driverId) {
        const driverSnap = await db.collection('users').doc(nextRyd.driverId).get();
        if (driverSnap.exists()) driverProfile = driverSnap.data() as UserProfileData;
    }

    const dashboardRyd: DashboardRydData = {
        id: nextRyd.id,
        rydFor,
        isDriver,
        eventName: nextRyd.eventName || "Unnamed Ryd",
        destination: nextRyd.finalDestinationAddress || "TBD",
        rydStatus: nextRyd.status,
        eventTimestamp: nextRyd.plannedArrivalTime || nextRyd.proposedDepartureTime || now,
        driverName: driverProfile?.fullName,
        driverId: nextRyd.driverId,
        passengerStatus: isDriver ? undefined : nextRyd.passengerManifest.find(p => p.userId === rydFor.uid)?.status,
    };
    
    return { success: true, ryd: dashboardRyd };

  } catch (error: any) {
    const { message } = handleActionError(error, "getMyNextRydAction");
    return { success: false, message };
  }
}
