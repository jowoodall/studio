

'use server';

import admin from '@/lib/firebaseAdmin';
import {
  type UserProfileData,
  type DisplayRydData,
  type RydData,
  type ActiveRyd,
  UserRole,
  ActiveRydStatus,
  RydStatus,
  PassengerManifestStatus,
} from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { isAfter } from 'date-fns';

// --- Re-usable Helper Functions using Admin SDK ---

// Gets a user's profile. Returns null if not found.
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    if (!userId) return null;
    try {
        const userDocRef = admin.firestore().collection('users').doc(userId);
        const userDocSnap = await userDocRef.get();
        return userDocSnap.exists ? { uid: userDocSnap.id, ...userDocSnap.data() } as UserProfileData : null;
    } catch (error) {
        console.error(`[AdminAction] Error fetching profile for ${userId}:`, error);
        return null;
    }
}

// Converts Firestore Timestamps to ISO strings for client-side serialization
function toSerializable(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // Check if it's a Firestore Timestamp-like object (from a direct doc.data() call)
    if (typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    
    // Check if it's a plain object with seconds/nanoseconds (can happen after some transformations)
    if (typeof obj === 'object' && 'seconds' in obj && 'nanoseconds' in obj && Object.keys(obj).length === 2) {
        return new Timestamp(obj.seconds, obj.nanoseconds).toDate().toISOString();
    }
    
    // Recurse for arrays
    if (Array.isArray(obj)) return obj.map(toSerializable);
    
    // Recurse for objects
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            newObj[key] = toSerializable(obj[key]);
        }
        return newObj;
    }
    
    return obj;
}

// --- Server Actions ---

export async function getUpcomingRydzAction({ idToken }: { idToken: string }): Promise<{
    success: boolean;
    drivingRydz?: DisplayRydData[];
    passengerRydz?: DisplayRydData[];
    pendingRequests?: DisplayRydData[];
    message?: string;
}> {
  console.log('[Action: getUpcomingRydzAction] Fetching upcoming rydz using Admin SDK.');

  if (!idToken) {
    return { success: false, message: "Authentication token is required." };
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
        return { success: false, message: "User profile not found." };
    }

    const uidsToQuery = [userId];
    if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
        uidsToQuery.push(...userProfile.managedStudentIds);
    }
    
    const db = admin.firestore();

    const upcomingActiveRydStatuses: ActiveRydStatus[] = [
      ActiveRydStatus.PLANNING, ActiveRydStatus.AWAITING_PASSENGERS, ActiveRydStatus.RYD_PLANNED,
      ActiveRydStatus.IN_PROGRESS_PICKUP, ActiveRydStatus.IN_PROGRESS_ROUTE,
    ];
    const pendingRequestStatuses: RydStatus[] = ['requested', 'searching_driver'];

    // Queries using Admin SDK
    const drivingQuery = db.collection('activeRydz').where('driverId', '==', userId).where('status', 'in', upcomingActiveRydStatuses);
    const passengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains-any', uidsToQuery).where('status', 'in', upcomingActiveRydStatuses);
    const requestsQuery = db.collection('rydz').where('passengerIds', 'array-contains-any', uidsToQuery).where('status', 'in', pendingRequestStatuses);
    
    const [drivingSnap, passengerSnap, requestsSnap] = await Promise.all([
      drivingQuery.get(),
      passengerQuery.get(),
      requestsQuery.get()
    ]);

    // Hydrate Rydz with Profiles
    const hydrateRyd = async (rydDoc: admin.firestore.DocumentSnapshot, isDriver: boolean): Promise<DisplayRydData> => {
        const rydData = rydDoc.data() as ActiveRyd;
        const passengerProfiles = await Promise.all((rydData.passengerUids || []).map(id => getUserProfile(id)));
        const driverProfile = isDriver ? userProfile : await getUserProfile(rydData.driverId);
        return {
            ...rydData,
            id: rydDoc.id,
            isDriver,
            passengerProfiles: passengerProfiles.filter(Boolean) as UserProfileData[],
            driverProfile: driverProfile || undefined,
            assignedActiveRydId: rydDoc.id,
            rydTimestamp: rydData.plannedArrivalTime || rydData.proposedDepartureTime,
        };
    };

    const hydrateRequest = async (reqDoc: admin.firestore.DocumentSnapshot): Promise<DisplayRydData> => {
        const reqData = reqDoc.data() as RydData;
        const passengerProfiles = await Promise.all((reqData.passengerIds || []).map(id => getUserProfile(id)));
        const driverProfile = reqData.driverId ? await getUserProfile(reqData.driverId) : undefined;
        return {
            ...reqData,
            id: reqDoc.id,
            isDriver: false,
            passengerProfiles: passengerProfiles.filter(Boolean) as UserProfileData[],
            driverProfile,
        };
    };

    const drivingRydzPromises = drivingSnap.docs.map(doc => hydrateRyd(doc, true));
    
    // Filter out rydz where user is both driver and passenger to avoid duplicates
    const passengerRydzPromises = passengerSnap.docs
      .filter(doc => doc.data().driverId !== userId) 
      .map(doc => hydrateRyd(doc, false));

    const pendingRequestsPromises = requestsSnap.docs.map(hydrateRequest);

    const [drivingRydz, passengerRydz, pendingRequests] = await Promise.all([
        Promise.all(drivingRydzPromises),
        Promise.all(passengerRydzPromises),
        Promise.all(pendingRequestsPromises)
    ]);
    
    const sortByTimestamp = (a: DisplayRydData, b: DisplayRydData) => {
        const timeA = (a.rydTimestamp as Timestamp)?.toMillis() || 0;
        const timeB = (b.rydTimestamp as Timestamp)?.toMillis() || 0;
        return timeA - timeB;
    };
    drivingRydz.sort(sortByTimestamp);
    passengerRydz.sort(sortByTimestamp);
    pendingRequests.sort(sortByTimestamp);

    return { 
      success: true, 
      drivingRydz: toSerializable(drivingRydz),
      passengerRydz: toSerializable(passengerRydz),
      pendingRequests: toSerializable(pendingRequests) 
    };

  } catch (error: any) {
    console.error(`[Action: getUpcomingRydzAction] Error:`, error);
    const errorMessage = error.code === 'failed-precondition' 
        ? `A Firestore index is required for this query. Please check your server terminal for an error message from Firestore that contains a link to create the necessary index automatically.`
        : `An unexpected server error occurred: ${error.message}`;
    return { success: false, message: errorMessage };
  }
}

export async function getRydHistoryAction({ idToken }: { idToken: string }): Promise<{
    success: boolean;
    history?: DisplayRydData[];
    message?: string;
}> {
    console.log('[Action: getRydHistoryAction] Fetching ryd history using Admin SDK.');
    if (!idToken) {
        return { success: false, message: "Authentication token is required." };
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const userProfile = await getUserProfile(userId);
        if (!userProfile) {
            return { success: false, message: "User profile not found." };
        }

        const uidsToQuery = [userId];
        if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
            uidsToQuery.push(...userProfile.managedStudentIds);
        }
        
        const db = admin.firestore();

        // Historical statuses
        const historicalActiveRydStatuses: ActiveRydStatus[] = [
            ActiveRydStatus.COMPLETED, ActiveRydStatus.CANCELLED_BY_DRIVER, ActiveRydStatus.CANCELLED_BY_SYSTEM,
        ];
        const historicalRequestStatuses: RydStatus[] = ['cancelled_by_user', 'no_driver_found'];

        const drivingQuery = db.collection('activeRydz').where('driverId', '==', userId).where('status', 'in', historicalActiveRydStatuses);
        const passengerQuery = db.collection('activeRydz').where('passengerUids', 'array-contains-any', uidsToQuery).where('status', 'in', historicalActiveRydStatuses);
        const requestsQuery = db.collection('rydz').where('passengerIds', 'array-contains-any', uidsToQuery).where('status', 'in', historicalRequestStatuses);

        const [drivingSnap, passengerSnap, requestsSnap] = await Promise.all([
            drivingQuery.get(),
            passengerQuery.get(),
            requestsQuery.get()
        ]);

        const allRydzMap = new Map<string, admin.firestore.DocumentSnapshot>();
        drivingSnap.docs.forEach(doc => allRydzMap.set(doc.id, doc));
        passengerSnap.docs.forEach(doc => allRydzMap.set(doc.id, doc));

        const hydrateRyd = async (rydDoc: admin.firestore.DocumentSnapshot): Promise<DisplayRydData> => {
            const rydData = rydDoc.data() as ActiveRyd;
            const passengerProfiles = await Promise.all((rydData.passengerUids || []).map(id => getUserProfile(id)));
            const driverProfile = await getUserProfile(rydData.driverId);
            return {
                ...rydData,
                id: rydDoc.id,
                isDriver: rydData.driverId === userId,
                passengerProfiles: passengerProfiles.filter(Boolean) as UserProfileData[],
                driverProfile: driverProfile || undefined,
                assignedActiveRydId: rydDoc.id,
                rydTimestamp: rydData.plannedArrivalTime || rydData.proposedDepartureTime || rydData.createdAt,
            };
        };

        const hydrateRequest = async (reqDoc: admin.firestore.DocumentSnapshot): Promise<DisplayRydData> => {
            const reqData = reqDoc.data() as RydData;
            const passengerProfiles = await Promise.all((reqData.passengerIds || []).map(id => getUserProfile(id)));
            return {
                ...reqData,
                id: reqDoc.id,
                isDriver: false,
                passengerProfiles: passengerProfiles.filter(Boolean) as UserProfileData[],
                rydTimestamp: reqData.rydTimestamp || reqData.createdAt,
            };
        };

        const rydPromises = Array.from(allRydzMap.values()).map(doc => hydrateRyd(doc));
        const requestPromises = requestsSnap.docs.map(doc => hydrateRequest(doc));

        const allItems = await Promise.all([...rydPromises, ...requestPromises]);
        
        allItems.sort((a, b) => {
            const timeA = (a.rydTimestamp as Timestamp)?.toMillis() || 0;
            const timeB = (b.rydTimestamp as Timestamp)?.toMillis() || 0;
            return timeB - timeA;
        });

        return { success: true, history: toSerializable(allItems) };
        
    } catch (error: any) {
        console.error(`[Action: getRydHistoryAction] Error:`, error);
        const errorMessage = error.code === 'failed-precondition' 
            ? `A Firestore index is required for this query. Please check your server terminal for an error message from Firestore that contains a link to create the necessary index automatically.`
            : `An unexpected server error occurred: ${error.message}`;
        return { success: false, message: errorMessage };
    }
}
