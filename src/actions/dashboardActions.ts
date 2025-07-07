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

    const passengerIdsForQuery = [userId];
    if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
        passengerIdsForQuery.push(...userProfile.managedStudentIds);
    }
    
    const now = Timestamp.now();
    const upcomingStatuses: ActiveRydStatus[] = [
      ActiveRydStatus.PLANNING,
      ActiveRydStatus.AWAITING_PASSENGERS,
      ActiveRydStatus.RYD_PLANNED,
      ActiveRydStatus.IN_PROGRESS_PICKUP,
      ActiveRydStatus.IN_PROGRESS_ROUTE,
    ];

    const drivingQuery = db.collection('activeRydz')
      .where('driverId', '==', userId)
      .where('status', 'in', upcomingStatuses)
      .where('plannedArrivalTime', '>=', now)
      .orderBy('plannedArrivalTime', 'asc')
      .limit(1);

    const passengerQuery = db.collection('activeRydz')
      .where('passengerUids', 'array-contains-any', passengerIdsForQuery)
      .where('status', 'in', upcomingStatuses)
      .where('plannedArrivalTime', '>=', now)
      .orderBy('plannedArrivalTime', 'asc')
      .limit(5); // Fetch a few to find the next relevant one

    const [drivingSnap, passengerSnap] = await Promise.all([
      drivingQuery.get(),
      passengerQuery.get(),
    ]);

    let nextRyd: ActiveRyd | null = null;
    let isDriver = false;

    const nextDrivingRyd = drivingSnap.empty ? null : { id: drivingSnap.docs[0].id, ...drivingSnap.docs[0].data() } as ActiveRyd;
    
    const passengerRydz = passengerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActiveRyd))
        .filter(ryd => ryd.driverId !== userId); // Exclude rydz they are driving
        
    const nextPassengerRyd = passengerRydz.length > 0 ? passengerRydz[0] : null;

    if (nextDrivingRyd && nextPassengerRyd) {
      if ((nextDrivingRyd.plannedArrivalTime as Timestamp).toMillis() <= (nextPassengerRyd.plannedArrivalTime as Timestamp).toMillis()) {
        nextRyd = nextDrivingRyd;
        isDriver = true;
      } else {
        nextRyd = nextPassengerRyd;
        isDriver = false;
      }
    } else if (nextDrivingRyd) {
      nextRyd = nextDrivingRyd;
      isDriver = true;
    } else if (nextPassengerRyd) {
      nextRyd = nextPassengerRyd;
      isDriver = false;
    }

    if (!nextRyd) {
      return { success: true, ryd: null };
    }

    // Determine which user this ryd is for (self or student)
    let rydFor = { name: userProfile.fullName, relation: 'self' as const, uid: userId };
    if (!isDriver) {
      for (const passengerId of passengerIdsForQuery) {
        if (nextRyd.passengerManifest.some(p => p.userId === passengerId)) {
          if (passengerId !== userId) {
            const studentProfileSnap = await db.collection('users').doc(passengerId).get();
            if (studentProfileSnap.exists()) {
              rydFor = { name: (studentProfileSnap.data() as UserProfileData).fullName, relation: 'student' as const, uid: passengerId };
            }
          }
          break; // Found the relevant passenger
        }
      }
    }
    
    let driverProfile: UserProfileData | undefined = undefined;
    if (!isDriver && nextRyd.driverId) {
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
        driverName: isDriver ? userProfile.fullName : driverProfile?.fullName,
        driverId: nextRyd.driverId,
        passengerStatus: isDriver ? undefined : nextRyd.passengerManifest.find(p => p.userId === rydFor.uid)?.status,
    };
    
    return { success: true, ryd: dashboardRyd };

  } catch (error: any) {
    const { message } = handleActionError(error, "getMyNextRydAction");
    return { success: false, message };
  }
}
