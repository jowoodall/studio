
'use server';

import admin from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfileData, ActiveRyd, DashboardRydData, UserRole, PassengerManifestStatus } from '@/types';

const db = admin.firestore();

const upcomingActiveRydStatuses = [
  'planning',
  'awaiting_passengers',
  'ryd_planned',
  'in_progress_pickup',
  'in_progress_route',
];

export async function getMyNextRydAction(userId: string): Promise<DashboardRydData | null> {
  console.log(`[DashboardAction] Fetching next ryd for user: ${userId}`);

  if (!userId) {
    console.log('[DashboardAction] No user ID provided.');
    return null;
  }

  try {
    const userProfileSnap = await db.collection('users').doc(userId).get();
    if (!userProfileSnap.exists) {
      console.log(`[DashboardAction] User profile not found for user: ${userId}`);
      return null;
    }
    const userProfile = userProfileSnap.data() as UserProfileData;

    const searchIds = [userId];
    if (userProfile.role === 'parent' && userProfile.managedStudentIds) {
      searchIds.push(...userProfile.managedStudentIds);
    }
    console.log(`[DashboardAction] Searching for rydz involving user IDs:`, searchIds);


    const rydzAsDriverQuery = db.collection('activeRydz')
      .where('driverId', 'in', searchIds)
      .where('status', 'in', upcomingActiveRydStatuses);

    const rydzAsPassengerQuery = db.collection('activeRydz')
      .where('passengerUids', 'array-contains-any', searchIds)
      .where('status', 'in', upcomingActiveRydStatuses);
    
    const [driverSnaps, passengerSnaps] = await Promise.all([
      rydzAsDriverQuery.get(),
      rydzAsPassengerQuery.get(),
    ]);

    const allRydzMap = new Map<string, ActiveRyd>();

    driverSnaps.forEach(doc => {
      allRydzMap.set(doc.id, { id: doc.id, ...doc.data() } as ActiveRyd);
    });
    passengerSnaps.forEach(doc => {
      allRydzMap.set(doc.id, { id: doc.id, ...doc.data() } as ActiveRyd);
    });
    
    if (allRydzMap.size === 0) {
        console.log(`[DashboardAction] No upcoming rydz found for any of the search IDs.`);
        return null;
    }

    const allRydz = Array.from(allRydzMap.values());
    console.log(`[DashboardAction] Found ${allRydz.length} unique upcoming rydz.`);

    allRydz.sort((a, b) => {
      const timeA = a.plannedArrivalTime || a.proposedDepartureTime;
      const timeB = b.plannedArrivalTime || b.proposedDepartureTime;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.toMillis() - timeB.toMillis();
    });

    const nextRyd = allRydz[0];
    if (!nextRyd) {
      return null;
    }
    console.log(`[DashboardAction] Next ryd identified: ${nextRyd.id}`);

    // --- New, more robust logic to determine who this ryd is for ---
    let rydFor: DashboardRydData['rydFor'] | null = null;
    let isDriver = false;
    let passengerStatus: PassengerManifestStatus | undefined = undefined;
    let earliestPickupTimestamp: Timestamp | undefined = undefined;

    // Check #1: Is the current user the driver?
    if (nextRyd.driverId === userId) {
      isDriver = true;
      rydFor = { name: 'You', relation: 'self', uid: userId };
    } 
    // Check #2: Is a managed student the driver?
    else if (userProfile.managedStudentIds?.includes(nextRyd.driverId)) {
      isDriver = true;
      const studentDriverId = nextRyd.driverId;
      const studentProfileSnap = await db.collection('users').doc(studentDriverId).get();
      if (studentProfileSnap.exists()) {
        rydFor = {
          name: studentProfileSnap.data()?.fullName || 'Your Student',
          relation: 'student',
          uid: studentDriverId
        };
      }
    }
    // If not a driver, check passenger manifest.
    else {
      isDriver = false;
      // Check #3: Is the current user a passenger?
      const userManifestItem = nextRyd.passengerManifest.find(p => p.userId === userId);
      if (userManifestItem) {
        rydFor = { name: 'You', relation: 'self', uid: userId };
        passengerStatus = userManifestItem.status;
        earliestPickupTimestamp = userManifestItem.earliestPickupTimestamp;
      }
      // Check #4: If not, is a managed student a passenger?
      else {
        for (const studentId of (userProfile.managedStudentIds || [])) {
          const studentManifestItem = nextRyd.passengerManifest.find(p => p.userId === studentId);
          if (studentManifestItem) {
            const studentProfileSnap = await db.collection('users').doc(studentId).get();
            if (studentProfileSnap.exists()) {
              rydFor = {
                name: studentProfileSnap.data()?.fullName || 'Your Student',
                relation: 'student',
                uid: studentId
              };
              passengerStatus = studentManifestItem.status;
              earliestPickupTimestamp = studentManifestItem.earliestPickupTimestamp;
              break; // Found the first student in the manifest, stop looking
            }
          }
        }
      }
    }
    
    if (!rydFor) {
        console.error(`[DashboardAction] Could not determine 'rydFor' for ryd ${nextRyd.id}. This can happen if a user is in 'passengerUids' but not the manifest, or if a linked student profile was deleted.`);
        return null;
    }

    let driverProfileData: UserProfileData | null = null;
    if (nextRyd.driverId) {
        const driverSnap = await db.collection('users').doc(nextRyd.driverId).get();
        if(driverSnap.exists) driverProfileData = driverSnap.data() as UserProfileData;
    }
    
    let eventTimestamp: Timestamp | undefined = undefined;
    if (nextRyd.associatedEventId) {
        const eventSnap = await db.collection('events').doc(nextRyd.associatedEventId).get();
        if (eventSnap.exists) eventTimestamp = eventSnap.data()?.eventTimestamp;
    }
    if (!eventTimestamp) eventTimestamp = nextRyd.plannedArrivalTime; // Fallback to arrival time

    const confirmedPassengers = nextRyd.passengerManifest.filter(p => p.status === 'confirmed_by_driver' || p.status === 'awaiting_pickup' || p.status === 'on_board').length;
    const pendingPassengers = nextRyd.passengerManifest.filter(p => p.status === 'pending_driver_approval').length;

    const result: DashboardRydData = {
        id: nextRyd.id,
        rydFor,
        isDriver,
        eventName: nextRyd.eventName || "Unnamed Ryd",
        destination: nextRyd.finalDestinationAddress || "Destination TBD",
        rydStatus: nextRyd.status,
        eventTimestamp: eventTimestamp!,
        earliestPickupTimestamp: earliestPickupTimestamp,
        proposedDepartureTimestamp: nextRyd.proposedDepartureTime,
        driverName: driverProfileData?.fullName,
        driverId: nextRyd.driverId,
        passengerCount: {
            confirmed: confirmedPassengers,
            pending: pendingPassengers,
            totalInManifest: nextRyd.passengerManifest.length
        },
        passengerStatus: passengerStatus
    };
    
    console.log("[DashboardAction] Successfully built dashboard data object:", result);
    return result;

  } catch (error: any) {
    console.error(`[DashboardAction] Error fetching rydz for user ${userId}:`, error);
    // Check for specific Firestore index error
    if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes("index"))) {
      console.error("[DashboardAction] Critical Error: A Firestore index is required for the dashboard query to function. The query failed. Please check the Firebase console for a link to create the required composite index.");
    }
    return null;
  }
}
