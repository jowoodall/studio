
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
          message = `You have rejected this driver for this ryd.`;
          break;
        case 'approve_once':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL; // Now goes to driver
          message = `Driver approved for this ryd. The request has been sent to the driver.`;
          break;
        case 'approve_permanently':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL;
          // Add driver to parent's approved list
          transaction.update(parentDocRef, {
            approvedDriverIds: FieldValue.arrayUnion(driverId)
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
