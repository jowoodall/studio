

'use server';

import admin from '@/lib/firebaseAdmin';
import type { EventData, UserProfileData, ActiveRyd, RydData, RydStatus, DisplayRydRequestData, DisplayActiveRyd, NotificationType } from '@/types';
import { ActiveRydStatus, PassengerManifestStatus, EventStatus as EventStatusEnum, NotificationType as NotificationTypeEnum } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { createNotification } from './notificationActions';

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
    if (doc.exists) {
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
        if (!eventDocSnap.exists) {
            return { success: false, message: `Event with ID "${eventId}" not found.` };
        }
        const eventDetails = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;

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

        // 4. Batch fetch all necessary user profiles for rydz, requests, AND managers
        const allUserIds = new Set<string>();
        (eventDetails.managerIds || []).forEach(id => allUserIds.add(id));
        activeRydzList.forEach(ryd => {
            allUserIds.add(ryd.driverId);
            ryd.passengerManifest.forEach(p => allUserIds.add(p.userId));
        });
        rydRequestsList.forEach(req => {
            allUserIds.add(req.requestedBy);
            req.passengerIds.forEach(id => allUserIds.add(id));
        });
        const allProfilesMap = await getMultipleUserProfiles(Array.from(allUserIds));

        // 5. Hydrate Managers
        const eventManagers = (eventDetails.managerIds || [])
            .map(id => allProfilesMap.get(id))
            .filter(Boolean) as UserProfileData[];

        // 6. Hydrate Active Rydz with profiles
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

        // 7. Hydrate Ryd Requests with profiles
        const hydratedRydRequests: DisplayRydRequestData[] = rydRequestsList.map(req => {
            return {
                ...req,
                requesterProfile: allProfilesMap.get(req.requestedBy),
                passengerUserProfiles: req.passengerIds.map(id => allProfilesMap.get(id)).filter(Boolean) as UserProfileData[],
            };
        });
        
        // 8. Serialize the entire data object before returning
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


// Internal helper function to notify group members of an event change
async function notifyGroupMembersOfEvent(
    eventId: string,
    eventName: string,
    actingUserId: string,
    groupIds: string[],
    action: 'created' | 'updated'
) {
    if (groupIds.length === 0) return;

    try {
        const groupsQuery = db.collection('groups').where(FieldValue.documentId(), 'in', groupIds);
        const groupsSnapshot = await groupsQuery.get();

        const memberIdsToNotify = new Set<string>();
        groupsSnapshot.forEach(doc => {
            const groupData = doc.data();
            groupData.memberIds?.forEach((memberId: string) => {
                if (memberId !== actingUserId) { // Don't notify the person who made the change
                    memberIdsToNotify.add(memberId);
                }
            });
        });

        const notificationPromises = Array.from(memberIdsToNotify).map(userId => {
            const title = `Event ${action === 'created' ? 'Created' : 'Updated'}`;
            const message = `The event "${eventName}" which is associated with one of your groups has been ${action}.`;
            return createNotification(userId, title, message, NotificationTypeEnum.INFO, `/events/${eventId}/rydz`);
        });

        await Promise.all(notificationPromises);
        console.log(`[Action: notifyGroupMembersOfEvent] Sent ${notificationPromises.length} notifications for event ${eventId}.`);

    } catch (error) {
        console.error(`[Action: notifyGroupMembersOfEvent] Failed to send notifications for event ${eventId}:`, error);
        // We don't throw an error here to avoid failing the main action if notifications fail
    }
}


export async function createEventAction(
    newEventData: Omit<EventData, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    creatorId: string,
): Promise<{ success: boolean; message: string; eventId?: string }> {
    try {
        const dataToSave = {
            ...newEventData,
            status: EventStatusEnum.ACTIVE,
            createdBy: creatorId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('events').add(dataToSave);

        // Send notifications to group members
        if (newEventData.associatedGroupIds && newEventData.associatedGroupIds.length > 0) {
            await notifyGroupMembersOfEvent(docRef.id, newEventData.name, creatorId, newEventData.associatedGroupIds, 'created');
        }

        return { success: true, message: 'Event created successfully.', eventId: docRef.id };
    } catch (error: any) {
        return handleActionError(error, "createEventAction");
    }
}

export async function updateEventAction(
    eventId: string,
    updateData: Partial<Omit<EventData, 'id' | 'createdAt' | 'updatedAt'>>,
    actingUserId: string,
): Promise<{ success: boolean; message: string }> {
    try {
        const eventDocRef = db.collection('events').doc(eventId);
        
        const dataToUpdate = {
            ...updateData,
            updatedAt: FieldValue.serverTimestamp(),
        };

        await eventDocRef.update(dataToUpdate);
        
        // Fetch the event name for the notification message
        const eventName = updateData.name || (await eventDocRef.get()).data()?.name || "Unnamed Event";

        // Send notifications if groups were associated
        if (updateData.associatedGroupIds && updateData.associatedGroupIds.length > 0) {
            await notifyGroupMembersOfEvent(eventId, eventName, actingUserId, updateData.associatedGroupIds, 'updated');
        }

        return { success: true, message: 'Event updated successfully.' };
    } catch (error: any) {
        return handleActionError(error, "updateEventAction");
    }
}
