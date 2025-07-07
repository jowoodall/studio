
'use server';

import admin from '@/lib/firebaseAdmin';
import type { DashboardRydData, ActiveRyd, UserProfileData } from '@/types';
import { UserRole, ActiveRydStatus } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

// --- Firestore REST API Helpers ---

// This function converts a document from Firestore's REST API format
// into a plain JavaScript object, similar to what the SDK provides.
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
      parsed[key] = Timestamp.fromDate(new Date(value.timestampValue));
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

// A helper to run a structured query against the Firestore REST API.
async function runFirestoreQuery(query: object, idToken: string): Promise<any[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase Project ID is not configured in environment variables.");
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery: query }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Firestore Query Error:", JSON.stringify(errorBody, null, 2));
    throw new Error(`Firestore query failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  // The response is an array of objects, either { document: ... } or { readTime: ... }.
  // We only care about the documents.
  return data.filter((item: any) => item.document).map((item: any) => parseFirestoreDocument(item.document));
}


// --- Main Action ---

export async function getMyNextRydAction({ idToken }: { idToken: string }): Promise<{ success: boolean; ryd?: DashboardRydData | null; message?: string }> {
  console.log(`[DashboardAction] Fetching next ryd using proxy model.`);

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


    // Define queries for Firestore REST API
    const drivingQuery = {
      from: [{ collectionId: 'activeRydz' }],
      where: {
        fieldFilter: { field: { fieldPath: 'driverId' }, op: 'EQUAL', value: { stringValue: userId } }
      },
    };
    const passengerQuery = {
      from: [{ collectionId: 'activeRydz' }],
      where: {
        fieldFilter: { field: { fieldPath: 'passengerUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: userId } }
      },
    };
    
    // Run queries in parallel
    const [drivingRydz, passengerRydz] = await Promise.all([
        runFirestoreQuery(drivingQuery, idToken),
        runFirestoreQuery(passengerQuery, idToken)
    ]);

    const allUserRydz: ActiveRyd[] = [...drivingRydz, ...passengerRydz]
      .map(item => item as ActiveRyd)
      .reduce((acc, current) => { // De-duplicate results
        if (!acc.find(item => item.id === current.id)) {
          acc.push(current);
        }
        return acc;
      }, [] as ActiveRyd[]);
      

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
    const isDriver = nextRyd.driverId === userId;
    
    const rydFor = { name: userProfile.fullName, relation: 'self' as const, uid: userId };
    
    let driverProfileData: UserProfileData | undefined = undefined;
    if (isDriver) {
        driverProfileData = userProfile;
    } else if (nextRyd.driverId) {
        const driverSnap = await admin.firestore().collection('users').doc(nextRyd.driverId).get();
        if (driverSnap.exists()) driverProfileData = driverSnap.data() as UserProfileData;
    }

    const dashboardRyd: DashboardRydData = {
        id: nextRyd.id,
        rydFor,
        isDriver,
        eventName: nextRyd.eventName || "Unnamed Ryd",
        destination: nextRyd.finalDestinationAddress || "TBD",
        rydStatus: nextRyd.status,
        eventTimestamp: nextRyd.plannedArrivalTime || nextRyd.proposedDepartureTime || now,
        driverName: driverProfileData?.fullName,
        driverId: nextRyd.driverId,
        passengerStatus: isDriver ? undefined : nextRyd.passengerManifest.find(p => p.userId === rydFor.uid)?.status,
    };
    
    return { success: true, ryd: dashboardRyd };

  } catch (error: any) {
    console.error(`[Action: getMyNextRydAction] Error:`, error);
    return { success: false, message: `An unexpected server error occurred: ${error.message}` };
  }
}
