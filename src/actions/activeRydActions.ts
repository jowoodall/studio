
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 1).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';

export async function createActiveRydForEventAction_Step1(
  userId: string, // This would be authUser.uid from the client
  data: OfferDriveFormStep1Values
): Promise<{ success: boolean; message: string; receivedData?: OfferDriveFormStep1Values; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called.");

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction_Step1] Error: userId not provided.");
    return { success: false, message: "User ID not provided. Authentication failed." };
  }
  console.log(`[Action: createActiveRydForEventAction_Step1] Processing for userId: ${userId}`, "with form data:", JSON.stringify(data, null, 2));

  const validationResult = offerDriveFormStep1Schema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction_Step1] Server-side validation failed:", validationResult.error.flatten());
    return { success: false, message: "Invalid form data.", issues: validationResult.error.issues };
  }
  console.log("[Action: createActiveRydForEventAction_Step1] Server-side input data validation successful.");

  // For this step, we are NOT interacting with Firestore.
  // We just acknowledge receipt and return the data.
  const successMessage = `Step 1 successful! Offer for event ${validationResult.data.eventId} with ${validationResult.data.seatsAvailable} seats received. Notes: ${validationResult.data.notes || 'N/A'}`;
  console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);
  
  return {
    success: true,
    message: successMessage,
    receivedData: validationResult.data,
  };
}
