
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData, FamilyData, SubscriptionTier } from '@/types';

const db = admin.firestore();

interface ManageFamilyMemberInput {
    actingUserId: string;
    familyId: string;
    action: 'add' | 'remove' | 'promote' | 'demote';
    targetMemberId?: string; // required for remove, promote, demote
    targetMemberEmail?: string; // required for add
}

// A centralized action to manage family members
export async function manageFamilyMemberAction(input: ManageFamilyMemberInput): Promise<{ success: boolean; message: string }> {
    const { actingUserId, familyId, action, targetMemberId, targetMemberEmail } = input;

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

        const batch = db.batch();

        switch (action) {
            case 'add':
                if (!targetMemberEmail) return { success: false, message: "Target member email is required for adding." };
                const usersRef = db.collection('users');
                const q = usersRef.where("email", "==", targetMemberEmail.trim().toLowerCase());
                const querySnapshot = await q.get();

                if (querySnapshot.empty) {
                    return { success: false, message: `No user found with the email: ${targetMemberEmail}` };
                }
                const userDocToAdd = querySnapshot.docs[0];
                const newMemberId = userDocToAdd.id;

                if (familyData.memberIds.includes(newMemberId)) {
                    return { success: false, message: `${userDocToAdd.data().fullName} is already a member of this family.` };
                }

                // Add to family's member list and user's family list
                batch.update(familyDocRef, { memberIds: FieldValue.arrayUnion(newMemberId) });
                batch.update(userDocToAdd.ref, { familyIds: FieldValue.arrayUnion(familyId) });

                await batch.commit();
                return { success: true, message: `${userDocToAdd.data().fullName} has been added to the family.` };

            case 'remove':
                if (!targetMemberId) return { success: false, message: "Target member ID is required for removal." };
                if (targetMemberId === actingUserId && familyData.adminIds.length <= 1) {
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
