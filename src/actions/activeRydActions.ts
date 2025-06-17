
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 2 - Modified to use client-provided canDrive).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
// Removed: import { db } from '@/lib/firebase';
// Removed: import { doc, getDoc } from 'firebase/firestore';
// Removed: import type { UserProfileData } from '@/types';

export async function createActiveRydForEventAction_Step1(
  userId: string,
  data: OfferDriveFormStep1Values,
  clientProvidedFullName: string, // New parameter
  clientProvidedCanDrive: boolean   // New parameter
): Promise<{ success: boolean; message: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called (Step 2 - Modified).");

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction_Step1] Error: userId not provided.");
    return { success: false, message: "User ID not provided. Authentication failed." };
  }
  
  console.log(`[Action: createActiveRydForEventAction_Step1] Processing for userId: ${userId}, clientFullName: ${clientProvidedFullName}, clientCanDrive: ${clientProvidedCanDrive} with form data:\n${JSON.stringify(data, null, 2)}`);

  const validationResult = offerDriveFormStep1Schema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction_Step1] Server-side validation failed:", validationResult.error.flatten());
    return { success: false, message: "Invalid form data.", issues: validationResult.error.issues };
  }
  console.log("[Action: createActiveRydForEventAction_Step1] Server-side input data validation successful.");

  // IMPORTANT SECURITY NOTE:
  // We are now TRUSTING the clientProvidedCanDrive status. In a production application,
  // this is a security risk. The server should ideally re-verify this from a trusted source (Firestore).
  // This change is made to work around the current server-side auth context issue for Firestore reads.
  if (!clientProvidedCanDrive) {
    console.error(`[Action: createActiveRydForEventAction_Step1] User ${userId} (${clientProvidedFullName}) is not permitted to drive based on client-provided status.`);
    return {
      success: false,
      message: "Your profile indicates you are not registered or permitted to drive. Please update your profile.",
      error: `User profile for ${userId} (${clientProvidedFullName}) does not have 'canDrive' set to true (based on client-provided data).`
    };
  }
  console.log(`[Action: createActiveRydForEventAction_Step1] Driver ${userId} (${clientProvidedFullName}) is permitted to drive (based on client-provided status).`);

  // At this point, we've "validated" the driver based on client-provided data.
  // Further steps (like fetching event details, creating activeRydz document) would go here.
  // For now, we'll return success.

  const successMessage = `Step 2 successful! Offer from ${clientProvidedFullName} (${userId}) for event ${validationResult.data.eventId} with ${validationResult.data.seatsAvailable} seats received. Driver status verified using client-provided data. Notes: ${validationResult.data.notes || 'N/A'}`;
  console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);

  return {
    success: true,
    message: successMessage,
  };
}
