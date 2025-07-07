
'use server';

import admin from '@/lib/firebaseAdmin';
import {
  type UserProfileData,
  type DisplayRydData,
  type RydData,
  type ActiveRyd,
  UserRole,
  ActiveRydStatus as ARStatus,
  RydStatus,
  PassengerManifestStatus,
} from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

// Helper to fetch user profile
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
        return null;
    }
    return userDocSnap.data() as UserProfileData;
}

export async function getUpcomingRydzAction(userId: string): Promise<{
    success: boolean,
    drivingRydz?: DisplayRydData[],
    passengerRydz?: DisplayRydData[],
    pendingRequests?: DisplayRydData[],
    message?: string,
}> {
    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }

    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
        return { success: false, message: 'User profile not found.' };
    }

    try {
        const passengerIdsForQuery = [userId];
        if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
            passengerIdsForQuery.push(...userProfile.managedStudentIds);
        }
        
        const upcomingActiveRydStatuses: ARStatus[] = [
            ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS, ARStatus.RYD_PLANNED,
            ARStatus.IN_PROGRESS_PICKUP, ARStatus.IN_PROGRESS_ROUTE,
        ];
        const pendingRequestStatuses: RydStatus[] = ['requested', 'searching_driver', 'driver_assigned'];
        
        const drivingQuery = db.collection('activeRydz').where('driverId', '==', userId).where('status', 'in', upcomingActiveRydStatuses);
        const passengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains-any', passengerIdsForQuery).where('status', 'in', upcomingActiveRydStatuses);
        const pendingRequestsQuery = db.collection('rydz').where('passengerIds', 'array-contains-any', passengerIdsForQuery).where('status', 'in', pendingRequestStatuses);

        const [drivingSnap, passengerSnap, pendingRequestsSnap] = await Promise.all([
            drivingQuery.get(),
            passengerQuery.get(),
            pendingRequestsQuery.get(),
        ]);
        
        // --- Process Driving Rydz ---
        const drivingRydzPromises = drivingSnap.docs.map(async (docSnap): Promise<DisplayRydData> => {
            const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
            let passengerProfiles: UserProfileData[] = [];
            if (activeRyd.passengerManifest && activeRyd.passengerManifest.length > 0) {
                const profilePromises = activeRyd.passengerManifest
                    .filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER)
                    .map(item => getUserProfile(item.userId));
                passengerProfiles = (await Promise.all(profilePromises)).filter(Boolean) as UserProfileData[];
            }
            return {
                id: activeRyd.id,
                rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
                destination: activeRyd.finalDestinationAddress || 'Destination TBD',
                eventName: activeRyd.eventName || activeRyd.finalDestinationAddress || 'Unnamed Ryd',
                status: activeRyd.status,
                driverProfile: userProfile,
                passengerProfiles,
                assignedActiveRydId: activeRyd.id,
                isDriver: true,
                requestedBy: activeRyd.driverId,
            };
        });
        
        // --- Process Passenger Rydz ---
        const passengerRydzPromises = passengerSnap.docs.map(async (docSnap): Promise<DisplayRydData> => {
            const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
            const driverProfileData = await getUserProfile(activeRyd.driverId);
            let passengerProfiles: UserProfileData[] = [];
            if (activeRyd.passengerManifest && activeRyd.passengerManifest.length > 0) {
                const profilePromises = activeRyd.passengerManifest
                    .filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER)
                    .map(item => getUserProfile(item.userId));
                passengerProfiles = (await Promise.all(profilePromises)).filter(Boolean) as UserProfileData[];
            }
            return {
                id: activeRyd.id,
                rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
                destination: activeRyd.finalDestinationAddress || 'Destination TBD',
                eventName: activeRyd.eventName || activeRyd.finalDestinationAddress || 'Unnamed Ryd',
                status: activeRyd.status,
                driverProfile: driverProfileData || undefined,
                passengerProfiles,
                assignedActiveRydId: activeRyd.id,
                isDriver: false,
            };
        });

        // --- Process Pending Rydz ---
        const pendingRequestsPromises = pendingRequestsSnap.docs.map(async (docSnap): Promise<DisplayRydData> => {
            const rydData = { id: docSnap.id, ...docSnap.data() } as RydData & { id: string };
            const driverProfileData = rydData.driverId ? await getUserProfile(rydData.driverId) : undefined;
            let passengerProfiles: UserProfileData[] = [];
            if (rydData.passengerIds && rydData.passengerIds.length > 0) {
                const profilePromises = rydData.passengerIds.map(item => getUserProfile(item));
                passengerProfiles = (await Promise.all(profilePromises)).filter(Boolean) as UserProfileData[];
            }
            return {
                id: rydData.id,
                rydTimestamp: rydData.rydTimestamp,
                destination: rydData.destination,
                eventName: rydData.eventName || rydData.destination,
                status: rydData.status,
                isDriver: false,
                driverProfile: driverProfileData || undefined,
                passengerProfiles: passengerProfiles,
                assignedActiveRydId: rydData.assignedActiveRydId,
                requestedBy: rydData.requestedBy,
            };
        });
        
        const [resolvedDrivingRydz, unfilteredPassengerRydz, pendingRequestsData] = await Promise.all([
            Promise.all(drivingRydzPromises),
            Promise.all(passengerRydzPromises),
            Promise.all(pendingRequestsPromises),
        ]);
        
        const drivingRydzIds = new Set(resolvedDrivingRydz.map(r => r.id));
        const finalPassengerRydz = unfilteredPassengerRydz.filter(r => !drivingRydzIds.has(r.id));
        
        resolvedDrivingRydz.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        finalPassengerRydz.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        pendingRequestsData.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        
        return {
            success: true,
            drivingRydz: resolvedDrivingRydz,
            passengerRydz: finalPassengerRydz,
            pendingRequests: pendingRequestsData,
        };

    } catch (error: any) {
        console.error("Error in getUpcomingRydzAction:", error);
        return { success: false, message: `An unexpected server error occurred: ${error.message}` };
    }
}
