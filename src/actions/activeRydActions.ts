
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 2).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfileData } from '@/types';

export async function createActiveRydForEventAction_Step1(
  userId: string,
  data: OfferDriveFormStep1Values
): Promise<{ success: boolean; message: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called (Step 2).");

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction_Step1] Error: userId not provided (Step 2).");
    return { success: false, message: "User ID not provided. Authentication failed." };
  }
  // Ensure the entire object is stringified and part of a single string argument
  console.log(`[Action: createActiveRydForEventAction_Step1] Processing for userId: ${userId} with form data:\n${JSON.stringify(data, null, 2)}`);

  const validationResult = offerDriveFormStep1Schema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction_Step1] Server-side validation failed (Step 2):", validationResult.error.flatten());
    return { success: false, message: "Invalid form data.", issues: validationResult.error.issues };
  }
  console.log("[Action: createActiveRydForEventAction_Step1] Server-side input data validation successful (Step 2).");

  try {
    console.log(`[Action: createActiveRydForEventAction_Step1] Attempting to fetch driver profile for UID: ${userId}`);
    const driverProfileRef = doc(db, "users", userId);
    const driverProfileSnap = await getDoc(driverProfileRef);

    if (!driverProfileSnap.exists()) {
      console.error(`[Action: createActiveRydForEventAction_Step1] Driver profile not found for UID: ${userId}`);
      return { success: false, message: `Driver profile not found for UID: ${userId}. Ensure a user document exists in Firestore at /users/${userId}.` };
    }

    const driverData = driverProfileSnap.data() as UserProfileData;
    console.log(`[Action: createActiveRydForEventAction_Step1] Fetched driver data for UID ${userId}:`, driverData);

    if (!driverData.canDrive) {
      console.error(`[Action: createActiveRydForEventAction_Step1] User ${userId} is not marked as 'canDrive' in their profile.`);
      return {
        success: false,
        message: "Your profile indicates you are not registered or permitted to drive. Please update your profile.",
        error: `User profile for ${userId} does not have 'canDrive' set to true.`
      };
    }
    console.log(`[Action: createActiveRydForEventAction_Step1] Driver ${userId} is permitted to drive.`);

  } catch (e: any) {
    console.error(`[Action: createActiveRydForEventAction_Step1] Critical Error fetching driver profile for UID ${userId}:`, e);
    let errorMessage = `Failed to fetch driver profile (UID: ${userId}).`;
    if (e.code === 'permission-denied') {
      errorMessage = `Permission Denied: Could not read your user profile (UID: ${userId}) from Firestore within the server action. This strongly suggests the server action is not running with your authenticated identity. Check Firestore rules and server authentication context. Code: ${e.code}. Message: ${e.message || 'Unknown Firebase error'}.`;
    } else {
      errorMessage += ` Error: ${e.message || 'Unknown error'}. Code: ${e.code || 'N/A'}.`;
    }
    return {
      success: false,
      message: "An error occurred while verifying driver status.",
      error: errorMessage
    };
  }

  const successMessage = `Step 2 successful! Driver profile validated for ${userId}. Offer for event ${validationResult.data.eventId} with ${validationResult.data.seatsAvailable} seats received. Notes: ${validationResult.data.notes || 'N/A'}`;
  console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);

  return {
    success: true,
    message: successMessage,
  };
}
