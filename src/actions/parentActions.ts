
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData, ActiveRyd } from '@/types';
import { PassengerManifestStatus, UserRole } from '@/types';

const db = admin.firestore();

// A robust, centralized error handler for server actions.
const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";
    if (errorMessage.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED') {
        return {
            success: false,
            message: `A server authentication or timeout error occurred. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`
        };
    }
    return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
};

export interface ManageDriverApprovalInput {
  parentUserId: string;
  studentUserId: string;
  driverId: string;
  activeRydId: string;
  decision: 'approve_once' | 'approve_permanently' | 'reject';
}

export async function manageDriverApprovalAction(
  input: ManageDriverApprovalInput
): Promise<{ success: boolean; message: string }> {
  const { parentUserId, studentUserId, driverId, activeRydId, decision } = input;
  
  if (!parentUserId || !studentUserId || !driverId || !activeRydId || !decision) {
    return { success: false, message: "Missing required parameters." };
  }

  const parentDocRef = db.collection('users').doc(parentUserId);
  const activeRydDocRef = db.collection('activeRydz').doc(activeRydId);
  
  try {
    const resultMessage = await db.runTransaction(async (transaction) => {
      const [parentDocSnap, activeRydDocSnap] = await transaction.getAll(parentDocRef, activeRydDocRef);
      
      if (!parentDocSnap.exists) {
        throw new Error("Parent profile not found.");
      }
      const parentProfile = parentDocSnap.data() as UserProfileData;

      // Authorization check
      if (parentProfile.role !== UserRole.PARENT || !parentProfile.managedStudentIds?.includes(studentUserId)) {
        throw new Error("Unauthorized: You are not registered as a parent for this student.");
      }

      if (!activeRydDocSnap.exists) {
        throw new Error("The associated ryd could not be found.");
      }
      const activeRydData = activeRydDocSnap.data() as ActiveRyd;

      const passengerIndex = activeRydData.passengerManifest.findIndex(
        p => p.userId === studentUserId && p.status === PassengerManifestStatus.PENDING_PARENT_APPROVAL
      );

      if (passengerIndex === -1) {
        throw new Error("This approval request is no longer pending or could not be found.");
      }

      const updatedManifest = [...activeRydData.passengerManifest];
      let newStatus: PassengerManifestStatus;
      let message = "";

      switch (decision) {
        case 'reject':
          newStatus = PassengerManifestStatus.REJECTED_BY_PARENT;
          transaction.update(parentDocRef, {
            declinedDriverIds: FieldValue.arrayUnion(driverId),
            approvedDriverIds: FieldValue.arrayRemove(driverId) // Also remove from approved if they were there
          });
          message = `You have rejected this driver for this ryd and added them to your declined list.`;
          break;
        case 'approve_once':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL; // Now goes to driver
          message = `Driver approved for this ryd. The request has been sent to the driver.`;
          break;
        case 'approve_permanently':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL;
          transaction.update(parentDocRef, {
            approvedDriverIds: FieldValue.arrayUnion(driverId),
            declinedDriverIds: FieldValue.arrayRemove(driverId) // Remove from declined if they were there
          });
          message = `Driver approved for this ryd and added to your permanent approved list.`;
          break;
        default:
          throw new Error("Invalid approval decision.");
      }
      
      updatedManifest[passengerIndex].status = newStatus;
      
      const updatePayload: any = {
        passengerManifest: updatedManifest,
        uidsPendingParentalApproval: FieldValue.arrayRemove(studentUserId), // Remove from pending list
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      transaction.update(activeRydDocRef, updatePayload);

      return message;
    });

    return { success: true, message: resultMessage };

  } catch (error: any) {
    return handleActionError(error, "manageDriverApprovalAction");
  }
}


interface UpdateDriverListInput {
    parentUserId: string;
    driverId: string;
    list: 'approved' | 'declined';
    action: 'add' | 'remove';
}

export async function updateDriverListAction(
    input: UpdateDriverListInput
): Promise<{ success: boolean; message: string }> {
    const { parentUserId, driverId, list, action } = input;

    if (!parentUserId || !driverId || !list || !action) {
        return { success: false, message: "Missing required parameters." };
    }

    const parentDocRef = db.collection('users').doc(parentUserId);

    try {
        const fieldToUpdate = list === 'approved' ? 'approvedDriverIds' : 'declinedDriverIds';
        const operation = action === 'add' ? FieldValue.arrayUnion(driverId) : FieldValue.arrayRemove(driverId);
        
        await parentDocRef.update({
            [fieldToUpdate]: operation
        });
        
        const actionVerb = action === 'add' ? 'added to' : 'removed from';
        const listName = list === 'approved' ? 'approved' : 'declined';

        return { success: true, message: `Driver successfully ${actionVerb} the ${listName} list.` };

    } catch (error: any) {
        return handleActionError(error, 'updateDriverListAction');
    }
}

interface AddApprovedDriverByEmailInput {
    parentUserId: string;
    driverEmail: string;
}

export async function addApprovedDriverByEmailAction(
    input: AddApprovedDriverByEmailInput
): Promise<{ success: boolean; message: string }> {
    const { parentUserId, driverEmail } = input;

    if (!parentUserId || !driverEmail) {
        return { success: false, message: "Parent ID and driver email are required." };
    }
    
    try {
        const usersRef = db.collection('users');
        const q = usersRef.where("email", "==", driverEmail.trim().toLowerCase());
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            return { success: false, message: `No user found with the email: ${driverEmail}` };
        }

        const driverDoc = querySnapshot.docs[0];
        const driverId = driverDoc.id;
        const driverData = driverDoc.data() as UserProfileData;

        if (driverId === parentUserId) {
            return { success: false, message: "You cannot add yourself as an approved driver." };
        }

        const parentDocRef = db.collection('users').doc(parentUserId);

        const batch = db.batch();
        
        batch.update(parentDocRef, {
            approvedDriverIds: FieldValue.arrayUnion(driverId),
            declinedDriverIds: FieldValue.arrayRemove(driverId)
        });
        
        await batch.commit();

        return { success: true, message: `${driverData.fullName || 'Driver'} has been added to your approved drivers list.` };

    } catch (error: any) {
        return handleActionError(error, 'addApprovedDriverByEmailAction');
    }
}
