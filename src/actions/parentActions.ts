
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { UserProfileData, ActiveRyd, NotificationType, FamilyData } from '@/types';
import { PassengerManifestStatus, UserRole, NotificationType as NotificationTypeEnum } from '@/types';
import { createNotification } from './notificationActions';

const db = admin.firestore();

// Helper function to get user profile (not transaction-aware)
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
  const userDocRef = db.collection('users').doc(userId);
  const userDocSnap = await userDocRef.get();
  if (!userDocSnap.exists) {
    return null;
  }
  return { uid: userDocSnap.id, ...userDocSnap.data() } as UserProfileData;
}


// A robust, centralized error handler for server actions.
const handleActionError = (error: any, actionName: string): { success: boolean, message: string } => {
    console.error(`[Action: ${actionName}] Error:`, error);
    const errorMessage = error.message || "An unknown server error occurred.";

    // Handle Firestore index errors
    if (error.code === 5 || error.code === 'failed-precondition' || (errorMessage.toLowerCase().includes("index") || errorMessage.toLowerCase().includes("missing a composite index"))) {
      return { success: false, message: `A Firestore index is required for this query. Please check your server terminal logs for an error message from Firestore that contains a link to create the necessary index automatically.` };
    }

    if (errorMessage.includes('Could not refresh access token') || error.code === 'DEADLINE_EXCEEDED') {
        return {
            success: false,
            message: `A server authentication or timeout error occurred. This is likely a temporary issue with the prototype environment's connection to Google services. Please try again in a moment.`
        };
    }
    return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
};

export interface ApprovalRequest {
  activeRydId: string;
  student: { uid: string; fullName: string; };
  driver: { uid: string; fullName: string; avatarUrl?: string; dataAiHint?: string; };
  rydDetails: { eventName: string; destination: string; };
}

export interface UserDisplayInfo {
  uid: string;
  fullName: string;
  avatarUrl?: string;
  dataAiHint?: string;
  email: string;
}

export interface ParentApprovalsPageData {
  pendingApprovals: ApprovalRequest[];
  approvedDrivers: UserDisplayInfo[];
  declinedDrivers: UserDisplayInfo[];
  managedStudents: UserDisplayInfo[];
}


export async function getParentApprovalsPageData(userId: string): Promise<{
    success: boolean;
    data?: ParentApprovalsPageData;
    message?: string;
}> {
    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }

    try {
        const parentDocRef = db.collection('users').doc(userId);
        const parentDocSnap = await parentDocRef.get();
        if (!parentDocSnap.exists() || parentDocSnap.data()?.role !== UserRole.PARENT) {
            return { success: false, message: 'This page is for parents only.' };
        }
        const userProfile = parentDocSnap.data() as UserProfileData;
        const studentIds = userProfile.managedStudentIds || [];

        let fetchedApprovals: ApprovalRequest[] = [];
        if (studentIds.length > 0) {
            const activeRydzRef = db.collection('activeRydz');
            const q = query(activeRydzRef, where('uidsPendingParentalApproval', 'array-contains-any', studentIds));
            const querySnapshot = await q.get();
            const approvalPromises = querySnapshot.docs.flatMap(docSnap => {
                const rydData = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
                const relevantPassengers = rydData.passengerManifest.filter(p => studentIds.includes(p.userId) && p.status === PassengerManifestStatus.PENDING_PARENT_APPROVAL);
                return relevantPassengers.map(async (passenger) => {
                    try {
                        const [driverDoc, studentDoc] = await Promise.all([
                            getDoc(doc(db, "users", rydData.driverId)),
                            getDoc(doc(db, "users", passenger.userId))
                        ]);
                        if (!driverDoc.exists() || !studentDoc.exists()) return null;
                        const driverData = driverDoc.data() as UserProfileData;
                        const studentData = studentDoc.data() as UserProfileData;
                        return {
                            activeRydId: rydData.id,
                            student: { uid: studentData.uid, fullName: studentData.fullName },
                            driver: { uid: driverData.uid, fullName: driverData.fullName, avatarUrl: driverData.avatarUrl, dataAiHint: driverData.dataAiHint },
                            rydDetails: { eventName: rydData.eventName || 'Unnamed Ryd', destination: rydData.finalDestinationAddress || 'N/A' },
                        };
                    } catch (e) {
                        console.error("Error processing an individual approval request:", e);
                        return null;
                    }
                });
            });
            fetchedApprovals = (await Promise.all(approvalPromises)).filter(Boolean) as ApprovalRequest[];
        }

        const fetchProfiles = async (ids: string[]): Promise<UserDisplayInfo[]> => {
            if (ids.length === 0) return [];
            const profilePromises = ids.map(async (id) => {
                try {
                    const docRef = doc(db, "users", id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfileData;
                        return { uid: id, fullName: data.fullName, avatarUrl: data.avatarUrl, dataAiHint: data.dataAiHint, email: data.email };
                    }
                    return null;
                } catch (e) {
                    console.error(`Failed to fetch profile for ID ${id}`, e);
                    return null;
                }
            });
            return (await Promise.all(profilePromises)).filter(Boolean) as UserDisplayInfo[];
        };

        const approvedDriverIds = Object.keys(userProfile.approvedDrivers || {});
        const [approvedList, declinedList, studentList] = await Promise.all([
            fetchProfiles(approvedDriverIds),
            fetchProfiles(userProfile.declinedDriverIds || []),
            fetchProfiles(userProfile.managedStudentIds || [])
        ]);

        return {
            success: true,
            data: {
                pendingApprovals: fetchedApprovals,
                approvedDrivers: approvedList,
                declinedDrivers: declinedList,
                managedStudents: studentList,
            }
        };

    } catch (error: any) {
        return handleActionError(error, "getParentApprovalsPageData");
    }
}


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
    const transactionResult = await db.runTransaction(async (transaction) => {
      const [parentDocSnap, activeRydDocSnap] = await transaction.getAll(parentDocRef, activeRydDocRef);
      
      if (!parentDocSnap.exists) { // remove exists()
        throw new Error("Parent profile not found.");
      }
      const parentProfile = parentDocSnap.data() as UserProfileData;

      // Authorization check
      if (parentProfile.role !== UserRole.PARENT || !parentProfile.managedStudentIds?.includes(studentUserId)) {
        throw new Error("Unauthorized: You are not registered as a parent for this student.");
      }

      if (!activeRydDocSnap.exists) { // remove exists()
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
      let parentUpdatePayload: any = {};
      const shouldNotifyDriver = decision === 'approve_once' || decision === 'approve_permanently';

      switch (decision) {
        case 'reject':
          newStatus = PassengerManifestStatus.REJECTED_BY_PARENT;
          parentUpdatePayload.declinedDriverIds = FieldValue.arrayUnion(driverId);
          // Also remove from approved map if they were there
          parentUpdatePayload[`approvedDrivers.${driverId}`] = FieldValue.delete();
          message = `You have rejected this driver for this ryd and added them to your declined list.`;
          break;
        case 'approve_once':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL; // Now goes to driver
          message = `Driver approved for this ryd. The request has been sent to the driver.`;
          break;
        case 'approve_permanently':
          newStatus = PassengerManifestStatus.PENDING_DRIVER_APPROVAL;
          // Add student to the driver's approval list within the map
          parentUpdatePayload[`approvedDrivers.${driverId}`] = FieldValue.arrayUnion(studentUserId);
          parentUpdatePayload.declinedDriverIds = FieldValue.arrayRemove(driverId);
          message = `Driver approved for this ryd and added to your approved list for this student.`;
          break;
        default:
          throw new Error("Invalid approval decision.");
      }
      
      if (Object.keys(parentUpdatePayload).length > 0) {
        transaction.update(parentDocRef, parentUpdatePayload);
      }
      
      updatedManifest[passengerIndex].status = newStatus;
      
      const rydUpdatePayload: any = {
        passengerManifest: updatedManifest,
        uidsPendingParentalApproval: FieldValue.arrayRemove(studentUserId),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      transaction.update(activeRydDocRef, rydUpdatePayload);

      return { 
        message, 
        shouldNotifyDriver,
        driverId: activeRydData.driverId,
        eventName: activeRydData.eventName
      };
    });

    // --- Create notification outside of transaction ---
    if (transactionResult.shouldNotifyDriver) {
        const studentProfile = await getUserProfile(studentUserId);
        await createNotification(
            transactionResult.driverId,
            'New Ryd Request',
            `${studentProfile?.fullName || 'A student'} has requested to join your ryd for "${transactionResult.eventName || 'the event'}" (approved by parent).`,
            NotificationTypeEnum.INFO,
            `/rydz/tracking/${activeRydId}`
        );
    }
    // --- End notification creation ---

    return { success: true, message: transactionResult.message };

  } catch (error: any) {
    return handleActionError(error, "manageDriverApprovalAction");
  }
}


interface UpdateDriverListInput {
    parentUserId: string;
    driverId: string;
    list: 'approved' | 'declined';
    action: 'remove'; // Only remove is supported now for simplicity
}

export async function updateDriverListAction(
    input: UpdateDriverListInput
): Promise<{ success: boolean; message: string }> {
    const { parentUserId, driverId, list, action } = input;

    if (!parentUserId || !driverId || !list || action !== 'remove') {
        return { success: false, message: "Missing required parameters or invalid action." };
    }

    const parentDocRef = db.collection('users').doc(parentUserId);

    try {
        let updatePayload = {};
        if (list === 'approved') {
            updatePayload = { [`approvedDrivers.${driverId}`]: FieldValue.delete() };
        } else { // declined
            updatePayload = { declinedDriverIds: FieldValue.arrayRemove(driverId) };
        }
        
        await parentDocRef.update(updatePayload);
        
        const listName = list === 'approved' ? 'approved' : 'declined';
        return { success: true, message: `Driver successfully removed from the ${listName} list.` };

    } catch (error: any) {
        return handleActionError(error, 'updateDriverListAction');
    }
}

interface AddApprovedDriverByEmailInput {
    parentUserId: string;
    driverEmail: string;
    studentIds: string[]; // Added studentIds
}

export async function addApprovedDriverByEmailAction(
    input: AddApprovedDriverByEmailInput
): Promise<{ success: boolean; message: string; driverId?: string; driverName?: string; }> {
    const { parentUserId, driverEmail, studentIds } = input;

    if (!parentUserId || !driverEmail || !studentIds || studentIds.length === 0) {
        return { success: false, message: "Parent ID, driver email, and at least one student selection are required." };
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
        
        // This will set or overwrite the list of approved students for this driver.
        await parentDocRef.update({
            [`approvedDrivers.${driverId}`]: studentIds,
            declinedDriverIds: FieldValue.arrayRemove(driverId)
        });
        
        return { 
            success: true, 
            message: `${driverData.fullName || 'Driver'} has been approved for the selected student(s).`,
            driverId: driverId,
            driverName: driverData.fullName,
        };

    } catch (error: any) {
        return handleActionError(error, 'addApprovedDriverByEmailAction');
    }
}

    