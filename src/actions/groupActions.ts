
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { GroupData, UserProfileData, NotificationType } from '@/types';
import { NotificationType as NotificationTypeEnum } from '@/types';
import { createNotification } from './notificationActions';

const db = admin.firestore();

// --- Serialization Helper ---
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

const handleActionError = (error: any, actionName: string): { success: boolean; message: string } => {
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

interface GroupsAndInvitations {
    joinedGroups: GroupData[];
    pendingInvitations: GroupData[];
}

export async function getGroupsAndInvitationsAction(userId: string): Promise<{ success: boolean; data?: GroupsAndInvitations, message?: string; }> {
    if (!userId) {
        return { success: false, message: "User ID is required." };
    }

    try {
        const userDocRef = db.collection('users').doc(userId);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
            return { success: false, message: "User profile not found." };
        }
        const userProfile = userDocSnap.data() as UserProfileData;
        const joinedGroupIds = userProfile.joinedGroupIds || [];

        // Query for all groups the user is a member of (invited to)
        const groupsQuery = db.collection('groups').where('memberIds', 'array-contains', userId);
        const groupsSnapshot = await groupsQuery.get();

        const joinedGroups: GroupData[] = [];
        const pendingInvitations: GroupData[] = [];

        groupsSnapshot.forEach(doc => {
            const group = { id: doc.id, ...doc.data() } as GroupData;
            if (joinedGroupIds.includes(group.id)) {
                joinedGroups.push(group);
            } else {
                pendingInvitations.push(group);
            }
        });

        // Sort results for consistent ordering
        const sortByTimestamp = (a: GroupData, b: GroupData) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis();
        joinedGroups.sort(sortByTimestamp);
        pendingInvitations.sort(sortByTimestamp);

        const serializableData = toSerializableObject({
            joinedGroups,
            pendingInvitations
        });
        
        return { success: true, data: serializableData as any };

    } catch (error: any) {
        return handleActionError(error, 'getGroupsAndInvitationsAction');
    }
}


export async function respondToGroupInvitationAction(
    userId: string,
    groupId: string,
    action: 'accept' | 'decline'
): Promise<{ success: boolean, message: string }> {
    if (!userId || !groupId || !action) {
        return { success: false, message: "User ID, Group ID, and action are required." };
    }

    const userDocRef = db.collection('users').doc(userId);
    const groupDocRef = db.collection('groups').doc(groupId);

    try {
        if (action === 'accept') {
            await userDocRef.update({
                joinedGroupIds: FieldValue.arrayUnion(groupId)
            });
            return { success: true, message: "Invitation accepted!" };
        } else { // decline
            await groupDocRef.update({
                memberIds: FieldValue.arrayRemove(userId),
                adminIds: FieldValue.arrayRemove(userId) // Also remove if they were an admin
            });
            return { success: true, message: "Invitation declined." };
        }
    } catch (error: any) {
        return handleActionError(error, 'respondToGroupInvitationAction');
    }
}
