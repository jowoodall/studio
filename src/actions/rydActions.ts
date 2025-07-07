
'use server';

import admin from '@/lib/firebaseAdmin';
import {
  type UserProfileData,
  type DisplayRydData,
  type RydData,
  type ActiveRyd,
  UserRole,
  ActiveRydStatus as ARStatus,
  RydStatus,
  PassengerManifestStatus,
} from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

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

// Helper to fetch user profile
async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
        return null;
    }
    return userDocSnap.data() as UserProfileData;
}

// getUpcomingRydzAction is no longer needed as the logic has been moved to the client.
// This file can be cleaned up or other ryd-related server actions can be placed here.
