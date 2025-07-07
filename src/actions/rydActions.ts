
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

    try {
        const userProfile = await getUserProfile(userId);
        if (!userProfile) {
            return { success: false, message: 'User profile not found.' };
        }
        
        const upcomingActiveRydStatuses: ARStatus[] = [
            ARStatus.PLANNING, ARStatus.AWAITING_PASSENGERS, ARStatus.RYD_PLANNED,
            ARStatus.IN_PROGRESS_PICKUP, ARStatus.IN_PROGRESS_ROUTE,
        ];
        const pendingRequestStatuses: RydStatus[] = ['requested', 'searching_driver', 'driver_assigned'];
        
        // Query for rydz the user is DRIVING
        const drivingQuery = db.collection('activeRydz')
            .where('driverId', '==', userId)
            .where('status', 'in', upcomingActiveRydStatuses);
        
        // Query for ACTIVE rydz the user is a PASSENGER in
        const passengerQuery = db.collection('activeRydz')
            .where('passengerUids', 'array-contains', userId)
            .where('status', 'in', upcomingActiveRydStatuses);
            
        // Query for PENDING requests where the user is a passenger
        const pendingRequestsQuery = db.collection('rydz')
            .where('passengerIds', 'array-contains', userId)
            .where('status', 'in', pendingRequestStatuses);
        

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
        
        const [resolvedDrivingRydz, resolvedPassengerRydz, pendingRequestsData] = await Promise.all([
            Promise.all(drivingRydzPromises),
            Promise.all(passengerRydzPromises),
            Promise.all(pendingRequestsPromises),
        ]);
        
        resolvedDrivingRydz.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        resolvedPassengerRydz.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        pendingRequestsData.sort((a, b) => (a.rydTimestamp as Timestamp).toMillis() - (b.rydTimestamp as Timestamp).toMillis());
        
        return {
            success: true,
            drivingRydz: resolvedDrivingRydz,
            passengerRydz: resolvedPassengerRydz,
            pendingRequests: pendingRequestsData,
        };

    } catch (error: any) {
        return handleActionError(error, "getUpcomingRydzAction");
    }
}
