
'use server';

import admin from '@/lib/firebaseAdmin';
import type { EventData, UserProfileData, ActiveRyd, RydData, RydStatus, DisplayRydRequestData, DisplayActiveRyd } from '@/types';
import { ActiveRydStatus, PassengerManifestStatus } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";

    if (error.code === 5 || (errorMessage.toLowerCase().includes("index") || errorMessage.toLowerCase().includes("missing a composite index"))) {
        return { success: false, message: `A Firestore index is required for this query. Please check your server terminal logs for an error message from Firestore that contains a link to create the necessary index automatically.` };
    }
    
    if (errorMessage.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED') {
       return {
        success: false,
        message: `A server authentication or timeout error occurred during '${actionName}'. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`,
       };
    }
    return { success: false, message: `An unexpected error occurred in ${actionName}: ${errorMessage}` };
};

// --- Serialization Helpers ---
// These functions ensure that any object with Firestore Timestamps is converted
// to an object with ISO date strings before being sent to the client.

const toSerializableObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Timestamp) return obj.toDate().toISOString();
    if (Array.isArray(obj)) return obj.map(toSerializableObject);
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            newObj[key] = toSerializableObject(obj[key]);
        }
        return newObj;
    }
    return obj;
};


// Helper function to get user profiles in a batch
async function getMultipleUserProfiles(userIds: string[]): Promise<Map<string, UserProfileData>> {
  if (userIds.length === 0) return new Map();
  const uniqueIds = [...new Set(userIds)];
  const userRefs = uniqueIds.map(id => db.collection('users').doc(id));
  const userDocs = await db.getAll(...userRefs);
  const profiles = new Map<string, UserProfileData>();
  userDocs.forEach(doc => {
    if (doc.exists()) {
      profiles.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfileData);
    }
  });
  return profiles;
}

interface EventRydzData {
  eventDetails: EventData | null;
  eventManagers: UserProfileData[];
  activeRydzList: DisplayActiveRyd[];
  rydRequestsList: DisplayRydRequestData[];
}

export async function getEventRydzPageDataAction(eventId: string): Promise<{
    success: boolean;
    data?: EventRydzData;
    message?: string;
}> {
    if (!eventId) {
        return { success: false, message: "Event ID is required." };
    }

    try {
        // 1. Fetch Event Details and Managers
        const eventDocRef = db.collection('events').doc(eventId);
        const eventDocSnap = await eventDocRef.get();
        if (!eventDocSnap.exists()) {
            return { success: false, message: `Event with ID "${eventId}" not found.` };
        }
        const eventDetails = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;

        const managerIds = eventDetails.managerIds || [];
        const managerProfilesMap = await getMultipleUserProfiles(managerIds);
        const eventManagers = Array.from(managerProfilesMap.values());

        // 2. Fetch Active Rydz for the event
        const activeRydzQuery = db.collection('activeRydz')
            .where('associatedEventId', '==', eventId)
            .orderBy('createdAt', 'desc');
        const activeRydzSnapshot = await activeRydzQuery.get();
        
        const activeRydzList: ActiveRyd[] = activeRydzSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActiveRyd));
        
        // 3. Fetch Ryd Requests for the event
        const rydRequestsQuery = db.collection('rydz')
            .where('eventId', '==', eventId)
            .where('status', 'in', ['requested', 'searching_driver'])
            .orderBy('createdAt', 'desc');
        const rydRequestsSnapshot = await rydRequestsQuery.get();
        const rydRequestsList: RydData[] = rydRequestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RydData));

        // 4. Batch fetch all necessary user profiles for rydz and requests
        const allUserIds = new Set<string>();
        activeRydzList.forEach(ryd => {
            allUserIds.add(ryd.driverId);
            ryd.passengerManifest.forEach(p => allUserIds.add(p.userId));
        });
        rydRequestsList.forEach(req => {
            allUserIds.add(req.requestedBy);
            req.passengerIds.forEach(id => allUserIds.add(id));
        });
        const allProfilesMap = await getMultipleUserProfiles(Array.from(allUserIds));

        // 5. Hydrate Active Rydz with profiles
        const hydratedActiveRydz: DisplayActiveRyd[] = activeRydzList.map(ryd => {
            return {
                ...ryd,
                driverProfile: allProfilesMap.get(ryd.driverId),
                passengerProfiles: ryd.passengerManifest.map(p => {
                    const profile = allProfilesMap.get(p.userId);
                    return profile ? { ...profile, manifestStatus: p.status } : undefined;
                }).filter(Boolean) as (UserProfileData & { manifestStatus?: PassengerManifestStatus })[],
            };
        });

        // 6. Hydrate Ryd Requests with profiles
        const hydratedRydRequests: DisplayRydRequestData[] = rydRequestsList.map(req => {
            return {
                ...req,
                requesterProfile: allProfilesMap.get(req.requestedBy),
                passengerUserProfiles: req.passengerIds.map(id => allProfilesMap.get(id)).filter(Boolean) as UserProfileData[],
            };
        });
        
        // 7. Serialize the entire data object before returning
        const serializableData = toSerializableObject({
            eventDetails,
            eventManagers,
            activeRydzList: hydratedActiveRydz,
            rydRequestsList: hydratedRydRequests,
        });

        return {
            success: true,
            data: serializableData as EventRydzData,
        };

    } catch (error: any) {
        return handleActionError(error, "getEventRydzPageDataAction");
    }
}
