
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData } from '@/types';
import { UserRole, UserStatus, SubscriptionTier } from '@/types';

const db = admin.firestore();

// A robust, centralized error handler for server actions.
const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";

    if (error.code === 'permission-denied') {
      return { success: false, message: `Permission denied. You might not have the correct role for this action.` };
    }
    
    return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
};


interface AssociateStudentInput {
    parentUid: string;
    studentEmail: string;
}

export async function associateStudentWithParentAction(input: AssociateStudentInput): Promise<{ success: boolean; message: string }> {
    const { parentUid, studentEmail } = input;
    if (!parentUid || !studentEmail) {
        return { success: false, message: "Parent and student email are required." };
    }

    const normalizedEmail = studentEmail.trim().toLowerCase();

    try {
        const parentDoc = await db.collection('users').doc(parentUid).get();
        if (!parentDoc.exists || parentDoc.data()?.role !== UserRole.PARENT) {
            return { success: false, message: "The requesting user is not a valid parent." };
        }

        const usersRef = db.collection('users');
        const studentQuery = usersRef.where("email", "==", normalizedEmail).limit(1);
        const studentQuerySnapshot = await studentQuery.get();
        
        let studentId: string;
        let studentFullName: string;

        if (studentQuerySnapshot.empty) {
            // User does not exist, create a placeholder/invited user
            const newStudentRef = usersRef.doc(); // Let Firestore generate a new ID
            studentId = newStudentRef.id;
            studentFullName = "Invited User"; // Placeholder name

            const newPlaceholderProfile: Omit<UserProfileData, 'uid'> = {
              fullName: studentFullName,
              email: normalizedEmail,
              role: UserRole.STUDENT,
              status: UserStatus.INVITED, // Set status to invited
              invitedBy: parentUid,
              onboardingComplete: false,
              subscriptionTier: SubscriptionTier.FREE,
              createdAt: FieldValue.serverTimestamp() as any,
              associatedParentIds: [parentUid], // Pre-associate the parent
              // Initialize other fields to be empty/default
              canDrive: false,
              joinedGroupIds: [],
              familyIds: [],
              approvedDrivers: {},
              declinedDriverIds: [],
              managedStudentIds: [],
            };
            
            await newStudentRef.set(newPlaceholderProfile);
            console.log(`[Action: associateStudentWithParent] Created placeholder for ${normalizedEmail} with ID ${studentId}.`);

        } else {
            // User exists, proceed as before
            const studentDoc = studentQuerySnapshot.docs[0];
            studentId = studentDoc.id;
            const studentData = studentDoc.data() as UserProfileData;
            studentFullName = studentData.fullName;

            if (studentData.role !== UserRole.STUDENT) {
                return { success: false, message: `${normalizedEmail} is not registered as a student.` };
            }
            if(parentDoc.data()?.managedStudentIds?.includes(studentId)){
                return { success: false, message: `${studentFullName} is already in your managed students list.` };
            }

            const studentDocRef = db.collection('users').doc(studentId);
            await studentDocRef.update({ associatedParentIds: FieldValue.arrayUnion(parentUid) });
        }
        
        // Update parent doc in both cases (new placeholder or existing user)
        const parentDocRef = db.collection('users').doc(parentUid);
        await parentDocRef.update({ 
            managedStudentIds: FieldValue.arrayUnion(studentId),
            [`approvedDrivers.${parentUid}`]: FieldValue.arrayUnion(studentId)
        });
        
        return { success: true, message: `${studentFullName} has been successfully linked. You may need to refresh to see the change.` };

    } catch (error) {
        return handleActionError(error, "associateStudentWithParentAction");
    }
}


interface AssociateParentInput {
    studentUid: string;
    parentEmail: string;
}

export async function associateParentWithStudentAction(input: AssociateParentInput): Promise<{ success: boolean; message: string }> {
    const { studentUid, parentEmail } = input;
    if (!studentUid || !parentEmail) {
        return { success: false, message: "Student and parent email are required." };
    }
    
    try {
        // Verify student is actually a student
        const studentDoc = await db.collection('users').doc(studentUid).get();
        if (!studentDoc.exists || studentDoc.data()?.role !== UserRole.STUDENT) {
            return { success: false, message: "The requesting user is not a valid student." };
        }

        // Find parent by email
        const usersRef = db.collection('users');
        const parentQuery = usersRef.where("email", "==", parentEmail.trim().toLowerCase());
        const parentQuerySnapshot = await parentQuery.get();

        if (parentQuerySnapshot.empty) {
            return { success: false, message: `No user found with the email: ${parentEmail}.` };
        }

        const parentDoc = parentQuerySnapshot.docs[0];
        const parentId = parentDoc.id;
        const parentData = parentDoc.data() as UserProfileData;

        if (parentData.role !== UserRole.PARENT) {
            return { success: false, message: `${parentEmail} is not registered as a parent.` };
        }
        
        if(studentDoc.data()?.associatedParentIds?.includes(parentId)){
            return { success: false, message: `${parentData.fullName} is already linked as a parent.` };
        }

        const batch = db.batch();

        // Update student doc
        const studentDocRef = db.collection('users').doc(studentUid);
        batch.update(studentDocRef, { associatedParentIds: FieldValue.arrayUnion(parentId) });
        
        // Update parent doc
        const parentDocRef = db.collection('users').doc(parentId);
        batch.update(parentDocRef, { 
            managedStudentIds: FieldValue.arrayUnion(studentUid),
            // When a student adds a parent, that parent is auto-approved for them.
            [`approvedDrivers.${parentId}`]: FieldValue.arrayUnion(studentUid)
        });

        await batch.commit();

        return { success: true, message: `${parentData.fullName} has been successfully linked. You may need to refresh to see the change.` };

    } catch (error) {
        return handleActionError(error, "associateParentWithStudentAction");
    }
}


interface SimpleStudentInfo {
    id: string;
    fullName: string;
}

export async function getManagedStudentsAction(parentId: string): Promise<{ success: boolean; students?: SimpleStudentInfo[]; message?: string; }> {
    if (!parentId) {
        return { success: false, message: "Parent ID is required." };
    }

    try {
        const parentDocRef = db.collection('users').doc(parentId);
        const parentDocSnap = await parentDocRef.get();

        if (!parentDocSnap.exists) {
            return { success: false, message: "Parent profile not found." };
        }

        const parentData = parentDocSnap.data() as UserProfileData;
        if (parentData.role !== UserRole.PARENT) {
            return { success: false, message: "User is not a parent." };
        }

        const studentIds = parentData.managedStudentIds || [];
        if (studentIds.length === 0) {
            return { success: true, students: [] };
        }

        const studentRefs = studentIds.map(id => db.collection('users').doc(id));
        const studentDocs = await db.getAll(...studentRefs);

        const students: SimpleStudentInfo[] = studentDocs
            .filter(doc => doc.exists)
            .map(doc => {
                const data = doc.data() as UserProfileData;
                return {
                    id: doc.id,
                    fullName: data.fullName
                };
            });

        return { success: true, students };

    } catch (error) {
        return handleActionError(error, "getManagedStudentsAction");
    }
}
