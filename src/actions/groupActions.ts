
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


type MemberRoleInGroup = "admin" | "member";

interface DisplayGroupMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  roleInGroup: MemberRoleInGroup;
  canDrive: boolean;
  email?: string;
  hasAcceptedInvitation: boolean; 
}

interface GroupManagementData {
    group: GroupData;
    members: DisplayGroupMember[];
}

export async function getGroupManagementDataAction(
    groupId: string,
    actingUserId: string
): Promise<{ success: boolean; data?: GroupManagementData; message?: string; }> {
    if (!groupId || !actingUserId) {
        return { success: false, message: "Group ID and acting User ID are required." };
    }

    try {
        const groupDocRef = db.collection('groups').doc(groupId);
        const groupDocSnap = await groupDocRef.get();
        if (!groupDocSnap.exists) {
            return { success: false, message: `Group with ID "${groupId}" not found.` };
        }
        const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as GroupData;

        // Authorization check
        if (!groupData.memberIds.includes(actingUserId)) {
            return { success: false, message: "You are not a member of this group." };
        }

        let members: DisplayGroupMember[] = [];
        if (groupData.memberIds.length > 0) {
            const memberRefs = groupData.memberIds.map(id => db.collection('users').doc(id));
            const memberDocs = await db.getAll(...memberRefs);
            
            members = memberDocs.map(userDocSnap => {
                if (!userDocSnap.exists) return null;
                const userData = userDocSnap.data() as UserProfileData;
                const hasAccepted = (userData.joinedGroupIds || []).includes(groupId);
                return {
                    id: userDocSnap.id,
                    name: userData.fullName,
                    avatarUrl: userData.avatarUrl,
                    dataAiHint: userData.dataAiHint,
                    roleInGroup: groupData.adminIds.includes(userDocSnap.id) ? "admin" : "member",
                    canDrive: userData.canDrive || false,
                    email: userData.email,
                    hasAcceptedInvitation: hasAccepted,
                };
            }).filter(Boolean) as DisplayGroupMember[];
        }

        return {
            success: true,
            data: {
                group: toSerializableObject(groupData),
                members,
            }
        };

    } catch (error: any) {
        return handleActionError(error, 'getGroupManagementDataAction');
    }
}


interface ManageGroupMemberInput {
    actingUserId: string;
    groupId: string;
    action: 'add' | 'remove' | 'promote' | 'demote';
    targetMemberId?: string; 
    targetMemberEmail?: string;
}

export async function manageGroupMemberAction(
    input: ManageGroupMemberInput
): Promise<{ success: boolean; message: string; }> {
    const { actingUserId, groupId, action, targetMemberId, targetMemberEmail } = input;
    
    if (!actingUserId || !groupId || !action) {
        return { success: false, message: "Missing required parameters." };
    }

    const groupDocRef = db.collection('groups').doc(groupId);
    
    try {
        const actingUserDoc = await db.collection('users').doc(actingUserId).get();
        if (!actingUserDoc.exists) {
            return { success: false, message: "Acting user profile not found." };
        }
        
        const groupDoc = await groupDocRef.get();
        if (!groupDoc.exists) {
            return { success: false, message: "Group not found." };
        }
        const groupData = groupDoc.data() as GroupData;

        const isActingUserAdmin = groupData.adminIds.includes(actingUserId);

        // --- Permission Checks ---
        if (action !== 'remove' && !isActingUserAdmin) {
            return { success: false, message: "Only group admins can perform this action." };
        }
        if (action === 'remove' && targetMemberId !== actingUserId && !isActingUserAdmin) {
            return { success: false, message: "Only group admins can remove other members." };
        }

        const batch = db.batch();

        switch (action) {
            case 'add':
                if (!targetMemberEmail) return { success: false, message: "Target member email is required." };
                const usersSnapshot = await db.collection('users').where("email", "==", targetMemberEmail.trim().toLowerCase()).limit(1).get();
                if (usersSnapshot.empty) {
                    return { success: false, message: `No user found with email: ${targetMemberEmail}.` };
                }
                const newMemberDoc = usersSnapshot.docs[0];
                if (groupData.memberIds.includes(newMemberDoc.id)) {
                    return { success: true, message: `${newMemberDoc.data().fullName} is already in the group.` };
                }
                batch.update(groupDocRef, { memberIds: FieldValue.arrayUnion(newMemberDoc.id) });
                
                await createNotification(
                    newMemberDoc.id, `Group Invitation`,
                    `You have been invited to join the group "${groupData.name}".`,
                    NotificationTypeEnum.INFO, '/groups'
                );
                await batch.commit();
                return { success: true, message: `${newMemberDoc.data().fullName} has been invited to the group.` };

            case 'remove':
                if (!targetMemberId) return { success: false, message: "Target member ID is required." };
                if (targetMemberId === actingUserId && isActingUserAdmin && groupData.adminIds.length <= 1 && groupData.memberIds.length > 1) {
                    return { success: false, message: "You cannot remove yourself as the last admin if other members remain. Promote another admin first." };
                }
                batch.update(groupDocRef, { memberIds: FieldValue.arrayRemove(targetMemberId), adminIds: FieldValue.arrayRemove(targetMemberId) });
                batch.update(db.collection('users').doc(targetMemberId), { joinedGroupIds: FieldValue.arrayRemove(groupId) });
                await batch.commit();
                return { success: true, message: "Member removed successfully." };

            case 'promote':
                if (!targetMemberId) return { success: false, message: "Target member ID is required." };
                batch.update(groupDocRef, { adminIds: FieldValue.arrayUnion(targetMemberId) });
                await batch.commit();
                return { success: true, message: "Member promoted to admin." };
            
            case 'demote':
                if (!targetMemberId) return { success: false, message: "Target member ID is required." };
                if (targetMemberId === actingUserId) return { success: false, message: "You cannot demote yourself." };
                if (groupData.adminIds.length <= 1 && groupData.adminIds.includes(targetMemberId)) {
                    return { success: false, message: "Cannot demote the last admin." };
                }
                batch.update(groupDocRef, { adminIds: FieldValue.arrayRemove(targetMemberId) });
                await batch.commit();
                return { success: true, message: "Admin demoted to member." };
                
            default:
                return { success: false, message: "Invalid action." };
        }

    } catch (error: any) {
        return handleActionError(error, `manageGroupMemberAction:${action}`);
    }
}
