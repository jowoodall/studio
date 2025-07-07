
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

// --- Firestore REST API Helpers ---
// These helpers allow us to run queries against Firestore's REST API using a user's
// ID token, which enforces security rules and avoids Admin SDK credential issues.

function parseFirestoreDocument(doc: any): any {
  const fields = doc.fields || {};
  const parsed: { [key: string]: any } = {};

  for (const key in fields) {
    const value = fields[key];
    if (value.stringValue !== undefined) {
      parsed[key] = value.stringValue;
    } else if (value.integerValue !== undefined) {
      parsed[key] = parseInt(value.integerValue, 10);
    } else if (value.doubleValue !== undefined) {
      parsed[key] = value.doubleValue;
    } else if (value.booleanValue !== undefined) {
      parsed[key] = value.booleanValue;
    } else if (value.timestampValue !== undefined) {
      // Return as a string for client-side serialization
      parsed[key] = value.timestampValue;
    } else if (value.mapValue !== undefined) {
      parsed[key] = parseFirestoreDocument(value.mapValue);
    } else if (value.arrayValue !== undefined) {
      parsed[key] = (value.arrayValue.values || []).map((v: any) => parseFirestoreDocument({ fields: { inner: v } }).inner);
    } else if (value.nullValue !== undefined) {
      parsed[key] = null;
    }
  }

  if (doc.name) {
    parsed.id = doc.name.split('/').pop();
  }
  
  return parsed;
}

async function runFirestoreQuery(query: object, idToken: string): Promise<any[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase Project ID is not configured.");
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery: query }),
    cache: 'no-store', // Ensure fresh data is fetched
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Firestore Query Error:", JSON.stringify(errorBody, null, 2));
    throw new Error(`Firestore query failed: ${errorBody.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data
    .filter((item: any) => item.document)
    .map((item: any) => parseFirestoreDocument(item.document));
}

async function getClientSideUserProfile(userId: string, idToken: string): Promise<UserProfileData | null> {
    if (!userId) return null;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${idToken}` },
        });
        if (!response.ok) return null;
        const data = await response.json();
        return parseFirestoreDocument(data) as UserProfileData;
    } catch (error) {
        console.error(`Error fetching profile for ${userId}:`, error);
        return null;
    }
}


export async function getUpcomingRydzAction({ idToken }: { idToken: string }): Promise<{
    success: boolean;
    drivingRydz?: DisplayRydData[];
    passengerRydz?: DisplayRydData[];
    pendingRequests?: DisplayRydData[];
    message?: string;
}> {
  console.log('[Action: getUpcomingRydzAction] Fetching upcoming rydz using proxy model.');

  if (!idToken) {
    return { success: false, message: "Authentication token is required." };
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const userProfileSnap = await admin.firestore().collection('users').doc(userId).get();
    if (!userProfileSnap.exists) {
        return { success: false, message: "User profile not found." };
    }
    const userProfile = userProfileSnap.data() as UserProfileData;

    const uidsToQuery = [userId];
    if (userProfile.role === UserRole.PARENT && userProfile.managedStudentIds) {
        uidsToQuery.push(...userProfile.managedStudentIds);
    }

    const upcomingActiveRydStatuses: ActiveRydStatus[] = [
      ActiveRydStatus.PLANNING, ActiveRydStatus.AWAITING_PASSENGERS, ActiveRydStatus.RYD_PLANNED,
      ActiveRydStatus.IN_PROGRESS_PICKUP, ActiveRydStatus.IN_PROGRESS_ROUTE,
    ];
    const pendingRequestStatuses: RydStatus[] = ['requested', 'searching_driver', 'driver_assigned'];

    const drivingQuery = { from: [{ collectionId: 'activeRydz' }], where: { fieldFilter: { field: { fieldPath: 'driverId' }, op: 'EQUAL', value: { stringValue: userId } } } };
    const passengerQuery = { from: [{ collectionId: 'activeRydz' }], where: { fieldFilter: { field: { fieldPath: 'passengerUids' }, op: 'ARRAY_CONTAINS_ANY', value: { arrayValue: { values: uidsToQuery.map(id => ({ stringValue: id })) } } } } };
    const requestsQuery = { from: [{ collectionId: 'rydz' }], where: { fieldFilter: { field: { fieldPath: 'passengerIds' }, op: 'ARRAY_CONTAINS_ANY', value: { arrayValue: { values: uidsToQuery.map(id => ({ stringValue: id })) } } } } };

    const [drivingResults, passengerResults, requestsResults] = await Promise.all([
      runFirestoreQuery(drivingQuery, idToken),
      runFirestoreQuery(passengerQuery, idToken),
      runFirestoreQuery(requestsQuery, idToken),
    ]);
    
    const drivingRydzPromises = drivingResults
      .filter(ryd => upcomingActiveRydStatuses.includes(ryd.status))
      .map(async (ryd: ActiveRyd): Promise<DisplayRydData> => {
        const passengerProfiles = (await Promise.all((ryd.passengerUids || []).map(id => getClientSideUserProfile(id, idToken)))).filter(Boolean) as UserProfileData[];
        return {
          ...ryd,
          isDriver: true,
          passengerProfiles,
          driverProfile: await getClientSideUserProfile(userId, idToken) || undefined,
          assignedActiveRydId: ryd.id,
          rydTimestamp: ryd.plannedArrivalTime || ryd.proposedDepartureTime,
        };
      });

    const passengerRydzPromises = passengerResults
      .filter(ryd => ryd.driverId !== userId && upcomingActiveRydStatuses.includes(ryd.status))
      .map(async (ryd: ActiveRyd): Promise<DisplayRydData> => {
        const driverProfile = await getClientSideUserProfile(ryd.driverId, idToken);
        const passengerProfiles = (await Promise.all((ryd.passengerUids || []).map(id => getClientSideUserProfile(id, idToken)))).filter(Boolean) as UserProfileData[];
        return {
          ...ryd,
          isDriver: false,
          driverProfile: driverProfile || undefined,
          passengerProfiles,
          assignedActiveRydId: ryd.id,
          rydTimestamp: ryd.plannedArrivalTime || ryd.proposedDepartureTime,
        };
      });
      
    const pendingRequestsPromises = requestsResults
      .filter(req => pendingRequestStatuses.includes(req.status))
      .map(async (req: RydData): Promise<DisplayRydData> => {
        const driverProfile = req.driverId ? await getClientSideUserProfile(req.driverId, idToken) : undefined;
        const passengerProfiles = (await Promise.all((req.passengerIds || []).map(id => getClientSideUserProfile(id, idToken)))).filter(Boolean) as UserProfileData[];
        return {
          ...req,
          isDriver: false,
          driverProfile,
          passengerProfiles,
        };
      });

    const [drivingRydz, passengerRydz, pendingRequests] = await Promise.all([
        Promise.all(drivingRydzPromises),
        Promise.all(passengerRydzPromises),
        Promise.all(pendingRequestsPromises)
    ]);

    // --- NEW FILTERING LOGIC ---
    const now = new Date();
    // Allow rydz from the last 6 hours to still show up, e.g., if they are in progress.
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000); 

    const filterTrulyUpcoming = (ryd: DisplayRydData) => {
      if (!ryd.rydTimestamp) return false; // Don't show rydz without a timestamp
      
      const rydTime = new Date(ryd.rydTimestamp);
      const isInProgress = ryd.status === ActiveRydStatus.IN_PROGRESS_PICKUP || ryd.status === ActiveRydStatus.IN_PROGRESS_ROUTE;
      
      // Keep if it's in progress, OR if the event time is after 6 hours ago.
      return isInProgress || isAfter(rydTime, sixHoursAgo);
    };

    const finalDrivingRydz = drivingRydz.filter(filterTrulyUpcoming);
    const finalPassengerRydz = passengerRydz.filter(filterTrulyUpcoming);
    const finalPendingRequests = pendingRequests.filter(filterTrulyUpcoming);
    // --- END NEW FILTERING LOGIC ---


    const sortByTimestamp = (a: DisplayRydData, b: DisplayRydData) => new Date(a.rydTimestamp).getTime() - new Date(b.rydTimestamp).getTime();
    finalDrivingRydz.sort(sortByTimestamp);
    finalPassengerRydz.sort(sortByTimestamp);
    finalPendingRequests.sort(sortByTimestamp);

    return { 
      success: true, 
      drivingRydz: finalDrivingRydz, 
      passengerRydz: finalPassengerRydz, 
      pendingRequests: finalPendingRequests 
    };

  } catch (error: any) {
    console.error(`[Action: getUpcomingRydzAction] Error:`, error);
    return { success: false, message: `An unexpected server error occurred: ${error.message}` };
  }
}
