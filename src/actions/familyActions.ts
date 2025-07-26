
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { UserProfileData, FamilyData, SubscriptionTier, NotificationType } from '@/types';
import { UserRole, NotificationType as NotificationTypeEnum, UserStatus } from '@/types';
import { createNotification } from './notificationActions';

const db = admin.firestore();

// --- Serialization Helper ---
// This function ensures that any object with Firestore Timestamps is converted
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


export async function getFamilyDataAction(userId: string): Promise<{ success: boolean; families?: FamilyData[]; message?: string; }> {
    if (!userId) {
        return { success: false, message: "User ID is required." };
    }

    try {
        const familiesQuery = db.collection('families').where('memberIds', 'array-contains', userId);
        const querySnapshot = await familiesQuery.get();

        if (querySnapshot.empty) {
            return { success: true, families: [] };
        }

        const families = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as FamilyData));
        
        // This is necessary because Timestamps are not directly serializable to the client.
        const serializableFamilies = families.map(family => toSerializableObject(family));

        return { success: true, families: serializableFamilies as any };

    } catch (error: any) {
        return handleActionError(error, 'getFamilyDataAction');
    }
}


interface ManageFamilyMemberInput {
    actingUserId: string;
    familyId: string;
    action: 'add' | 'remove' | 'promote' | 'demote';
    targetMemberId?: string; // required for remove, promote, demote
    targetMemberEmail?: string; // required for add
    forceCreate?: boolean; // Added for add action
}

// A centralized action to manage family members
export async function manageFamilyMemberAction(input: ManageFamilyMemberInput): Promise<{ success: boolean; message: string; userExists?: boolean; }> {
    const { actingUserId, familyId, action, targetMemberId, targetMemberEmail, forceCreate = false } = input;

    const familyDocRef = db.collection('families').doc(familyId);

    try {
        const familyDocSnap = await familyDocRef.get();
        if (!familyDocSnap.exists) {
            return { success: false, message: "Family not found." };
        }
        const familyData = familyDocSnap.data() as FamilyData;

        // Authorization: Only admins can perform actions
        if (!familyData.adminIds.includes(actingUserId)) {
            return { success: false, message: "Permission denied. Only family admins can manage members." };
        }
        
        const actingUserDocRef = db.collection('users').doc(actingUserId);
        const actingUserDocSnap = await actingUserDocRef.get();
        if(!actingUserDocSnap.exists) {
            return { success: false, message: "Acting user profile not found." };
        }
        const actingUserData = actingUserDocSnap.data() as UserProfileData;


        const batch = db.batch();

        switch (action) {
            case 'add':
                if (!targetMemberEmail) return { success: false, message: "Target member email is required for adding." };
                const normalizedEmail = targetMemberEmail.trim().toLowerCase();
                const usersRef = db.collection('users');
                const q = usersRef.where("email", "==", normalizedEmail);
                const querySnapshot = await q.get();
                
                let newMemberId;
                let userFullName;
                let successMessage;

                if (querySnapshot.empty) {
                     if (!forceCreate) {
                        return { 
                            success: true, 
                            message: `User with email ${normalizedEmail} does not exist. Please confirm you want to invite them.`,
                            userExists: false
                        };
                    }
                    // User does not exist, create a placeholder
                    const newPlaceholderRef = usersRef.doc();
                    newMemberId = newPlaceholderRef.id;
                    userFullName = "Invited User";
                    
                    const newPlaceholderProfile: Omit<UserProfileData, 'uid'> = {
                        fullName: userFullName,
                        email: normalizedEmail,
                        role: UserRole.STUDENT, // Default role for invited users
                        status: UserStatus.INVITED,
                        invitedBy: actingUserId,
                        onboardingComplete: false,
                        createdAt: FieldValue.serverTimestamp(),
                        familyIds: [familyId], // Pre-associate the family
                         // Initialize other fields
                        canDrive: false,
                        joinedGroupIds: [],
                        approvedDrivers: {},
                        declinedDriverIds: [],
                        managedStudentIds: [],
                        associatedParentIds: [],
                    };
                    
                    batch.set(newPlaceholderRef, newPlaceholderProfile);
                    successMessage = `${normalizedEmail} has been invited to MyRydz and added to the family.`;

                } else {
                    // User exists, add them normally
                    const userDocToAdd = querySnapshot.docs[0];
                    newMemberId = userDocToAdd.id;
                    userFullName = userDocToAdd.data().fullName;
                    
                    if (familyData.memberIds.includes(newMemberId)) {
                        return { success: false, message: `${userFullName} is already a member of this family.` };
                    }
                    batch.update(userDocToAdd.ref, { familyIds: FieldValue.arrayUnion(familyId) });
                    successMessage = `${userFullName} has been added to the family.`;
                }

                // Add to family's member list
                batch.update(familyDocRef, { memberIds: FieldValue.arrayUnion(newMemberId) });
                
                // Notification is created outside the batch commit
                await createNotification(
                    newMemberId,
                    'You were added to a family',
                    `${actingUserData.fullName} has added you to the family "${familyData.name}".`,
                    NotificationTypeEnum.SUCCESS,
                    `/family/${familyId}/manage`
                );

                await batch.commit();
                return { success: true, message: successMessage, userExists: true };

            case 'remove':
                if (!targetMemberId) return { success: false, message: "Target member ID is required for removal." };
                if (targetMemberId === actingUserId && familyData.adminIds.length <= 1 && familyData.memberIds.length > 1) {
                    return { success: false, message: "Cannot remove the last admin from the family." };
                }
                
                // Remove from family's lists and user's family list
                batch.update(familyDocRef, {
                    memberIds: FieldValue.arrayRemove(targetMemberId),
                    adminIds: FieldValue.arrayRemove(targetMemberId)
                });
                const memberUserDocRef = db.collection('users').doc(targetMemberId);
                batch.update(memberUserDocRef, { familyIds: FieldValue.arrayRemove(familyId) });

                await batch.commit();
                return { success: true, message: "Member successfully removed from the family." };

            case 'promote':
                if (!targetMemberId) return { success: false, message: "Target member ID is required for promotion." };
                batch.update(familyDocRef, { adminIds: FieldValue.arrayUnion(targetMemberId) });
                await batch.commit();
                return { success: true, message: "Member promoted to admin." };

            case 'demote':
                if (!targetMemberId) return { success: false, message: "Target member ID is required for demotion." };
                if (targetMemberId === actingUserId) {
                    return { success: false, message: "Admins cannot demote themselves." };
                }
                if (familyData.adminIds.length <= 1 && familyData.adminIds.includes(targetMemberId)) {
                    return { success: false, message: "Cannot demote the last admin." };
                }
                batch.update(familyDocRef, { adminIds: FieldValue.arrayRemove(targetMemberId) });
                await batch.commit();
                return { success: true, message: "Admin demoted to member." };

            default:
                return { success: false, message: "Invalid action specified." };
        }

    } catch (error: any) {
        console.error(`Error in manageFamilyMemberAction (action: ${action}):`, error);
        return { success: false, message: `An unexpected server error occurred: ${error.message}` };
    }
}

interface CreateFamilyInput {
    creatorId: string;
    familyName: string;
}

export async function createFamilyAction(input: CreateFamilyInput): Promise<{ success: boolean; message: string; familyId?: string }> {
    const { creatorId, familyName } = input;

    if (!creatorId || !familyName) {
        return { success: false, message: "Creator ID and family name are required." };
    }

    const batch = db.batch();
    const newFamilyRef = db.collection('families').doc(); // Create a ref with a new auto-generated ID

    const newFamilyData: Omit<FamilyData, 'id'> = {
        name: familyName,
        subscriptionTier: 'free' as SubscriptionTier.FREE,
        memberIds: [creatorId],
        adminIds: [creatorId],
        createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    };
    
    // 1. Set the new family document in the batch
    batch.set(newFamilyRef, newFamilyData);

    // 2. Update the creator's user profile to include the new family ID
    const userRef = db.collection('users').doc(creatorId);
    batch.update(userRef, {
        familyIds: FieldValue.arrayUnion(newFamilyRef.id)
    });

    try {
        await batch.commit();
        return { success: true, message: `Family "${familyName}" created successfully.`, familyId: newFamilyRef.id };
    } catch (error: any) {
        console.error("Error in createFamilyAction:", error);
        return { success: false, message: `An unexpected server error occurred: ${error.message}` };
    }
}

interface DisplayFamilyMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  roleInFamily: "admin" | "member";
  email?: string;
  userRole: UserRole;
}

interface FamilyManagementData {
    family: FamilyData;
    members: DisplayFamilyMember[];
}

export async function getFamilyManagementDataAction(
    familyId: string, 
    actingUserId: string
): Promise<{ success: boolean; data?: FamilyManagementData; message?: string }> {
    if (!familyId || !actingUserId) {
        return { success: false, message: "Family ID and User ID are required." };
    }

    try {
        const familyDocRef = db.collection('families').doc(familyId);
        const familyDocSnap = await familyDocRef.get();

        if (!familyDocSnap.exists) {
            return { success: false, message: `Family with ID "${familyId}" not found.` };
        }

        const familyData = { id: familyDocSnap.id, ...familyDocSnap.data() } as FamilyData;

        // Authorization: Ensure the user requesting is part of the family
        if (!familyData.memberIds.includes(actingUserId)) {
            return { success: false, message: "You are not authorized to view this family." };
        }
        
        let members: DisplayFamilyMember[] = [];
        if (familyData.memberIds && familyData.memberIds.length > 0) {
            const memberRefs = familyData.memberIds.map(id => db.collection('users').doc(id));
            const memberDocs = await db.getAll(...memberRefs);
            
            members = memberDocs.map(userDocSnap => {
                if (!userDocSnap.exists) return null;
                const userData = userDocSnap.data() as UserProfileData;
                return {
                    id: userDocSnap.id,
                    name: userData.fullName,
                    avatarUrl: userData.avatarUrl,
                    dataAiHint: userData.dataAiHint,
                    roleInFamily: familyData.adminIds.includes(userDocSnap.id) ? "admin" : "member",
                    email: userData.email,
                    userRole: userData.role,
                };
            }).filter(Boolean) as DisplayFamilyMember[];
        }

        const data: FamilyManagementData = {
            family: toSerializableObject(familyData) as FamilyData,
            members: members,
        };
        
        return { success: true, data };

    } catch (error: any) {
        return handleActionError(error, 'getFamilyManagementDataAction');
    }
}

interface FindFamiliesByMemberEmailInput {
    memberEmail: string;
}

export async function findFamiliesByMemberEmailAction(input: FindFamiliesByMemberEmailInput): Promise<{ success: boolean; families?: FamilyData[]; message: string; }> {
    const { memberEmail } = input;
    if (!memberEmail) {
        return { success: false, message: "Member email is required." };
    }

    try {
        const usersRef = db.collection('users');
        const memberQuery = usersRef.where("email", "==", memberEmail.trim().toLowerCase());
        const memberQuerySnapshot = await memberQuery.get();
        
        if (memberQuerySnapshot.empty) {
            return { success: false, message: `No user found with the email: ${memberEmail}` };
        }
        
        const memberDoc = memberQuerySnapshot.docs[0];
        const memberProfile = memberDoc.data() as UserProfileData;

        const familyIds = memberProfile.familyIds || [];
        if (familyIds.length === 0) {
            return { success: true, families: [], message: `${memberProfile.fullName} is not part of any family.` };
        }
        
        // Fetch all families the user is a member of
        const familyRefs = familyIds.map(id => db.collection('families').doc(id));
        const familyDocs = await db.getAll(...familyRefs);

        const families = familyDocs
            .filter(doc => doc.exists)
            .map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as FamilyData);

        return { success: true, families, message: `Found ${families.length} families.` };

    } catch (error: any) {
        return handleActionError(error, 'findFamiliesByMemberEmailAction');
    }
}


interface JoinFamilyByIdInput {
    joiningUserId: string;
    familyId: string;
}

export async function joinFamilyByIdAction(input: JoinFamilyByIdInput): Promise<{ success: boolean; message: string; }> {
    const { joiningUserId, familyId } = input;
    if (!joiningUserId || !familyId) {
        return { success: false, message: "User ID and Family ID are required." };
    }

    const batch = db.batch();
    const familyDocRef = db.collection('families').doc(familyId);
    const joiningUserRef = db.collection('users').doc(joiningUserId);

    try {
        const familyDocSnap = await familyDocRef.get();
        if (!familyDocSnap.exists) {
            return { success: false, message: `The selected family could not be found.` };
        }
        const familyData = familyDocSnap.data() as FamilyData;

        // Add the new user to the family's member list
        batch.update(familyDocRef, {
            memberIds: FieldValue.arrayUnion(joiningUserId)
        });

        // Add the family ID to the new user's profile
        batch.update(joiningUserRef, {
            familyIds: FieldValue.arrayUnion(familyId)
        });

        await batch.commit();

        return { success: true, message: `Successfully joined the family: "${familyData.name}".` };

    } catch (error: any) {
        return handleActionError(error, 'joinFamilyByIdAction');
    }
}
