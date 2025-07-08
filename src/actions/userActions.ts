'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData } from '@/types';
import { UserRole } from '@/types';

const db = admin.firestore();

// A robust, centralized error handler for server actions.
const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";

    if (error.code === 'permission-denied') {
      return { success: false, message: `Permission denied. You might not have the correct role for this action.` };
    }
    
    return { success: false, message: `An unexpected server error occurred: ${errorMessage}` };
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

    try {
        // Verify parent is actually a parent
        const parentDoc = await db.collection('users').doc(parentUid).get();
        if (!parentDoc.exists() || parentDoc.data()?.role !== UserRole.PARENT) {
            return { success: false, message: "The requesting user is not a valid parent." };
        }

        // Find student by email
        const usersRef = db.collection('users');
        const studentQuery = usersRef.where("email", "==", studentEmail.trim().toLowerCase());
        const studentQuerySnapshot = await studentQuery.get();
        
        if (studentQuerySnapshot.empty) {
            return { success: false, message: `No user found with the email: ${studentEmail}.` };
        }
        
        const studentDoc = studentQuerySnapshot.docs[0];
        const studentId = studentDoc.id;
        const studentData = studentDoc.data() as UserProfileData;

        if (studentData.role !== UserRole.STUDENT) {
            return { success: false, message: `${studentEmail} is not registered as a student.` };
        }

        if(parentDoc.data()?.managedStudentIds?.includes(studentId)){
            return { success: false, message: `${studentData.fullName} is already in your managed students list.` };
        }
        
        const batch = db.batch();

        // Update parent doc
        const parentDocRef = db.collection('users').doc(parentUid);
        batch.update(parentDocRef, { 
            managedStudentIds: FieldValue.arrayUnion(studentId),
            // Parent adding student should auto-approve themselves to drive that student
            [`approvedDrivers.${parentUid}`]: FieldValue.arrayUnion(studentId)
        });

        // Update student doc
        const studentDocRef = db.collection('users').doc(studentId);
        batch.update(studentDocRef, { associatedParentIds: FieldValue.arrayUnion(parentUid) });

        await batch.commit();
        
        return { success: true, message: `${studentData.fullName} has been successfully linked. You may need to refresh to see the change.` };

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
        if (!studentDoc.exists() || studentDoc.data()?.role !== UserRole.STUDENT) {
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
