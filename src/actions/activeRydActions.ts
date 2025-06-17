
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 3 - Modified to use client-provided event name).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
// Firestore getDoc and Timestamp are removed as we are not fetching the event from Firestore in this step
// import { db } from '@/lib/firebase';
// import { doc, getDoc, type Timestamp } from 'firebase/firestore';
// import type { EventData } from '@/types';

export async function createActiveRydForEventAction_Step1(
  userId: string,
  data: OfferDriveFormStep1Values,
  clientProvidedFullName: string,
  clientProvidedCanDrive: boolean,
  clientProvidedEventName: string // New parameter for event name
): Promise<{ success: boolean; message: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called (Step 3 - Using client-provided event name).");

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction_Step1] Error: userId not provided.");
    return { success: false, message: "User ID not provided. Authentication failed." };
  }
  
  console.log(`[Action: createActiveRydForEventAction_Step1] Processing for userId: ${userId}, clientFullName: ${clientProvidedFullName}, clientCanDrive: ${clientProvidedCanDrive}, clientEventName: ${clientProvidedEventName} with form data:\n${JSON.stringify(data, null, 2)}`);

  const validationResult = offerDriveFormStep1Schema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction_Step1] Server-side validation failed:", validationResult.error.flatten());
    return { success: false, message: "Invalid form data.", issues: validationResult.error.issues };
  }
  const validatedData = validationResult.data;
  console.log("[Action: createActiveRydForEventAction_Step1] Server-side input data validation successful.");

  // Driver permission check (using client-provided data)
  if (!clientProvidedCanDrive) {
    console.error(`[Action: createActiveRydForEventAction_Step1] User ${userId} (${clientProvidedFullName}) is not permitted to drive based on client-provided status.`);
    return {
      success: false,
      message: "Your profile indicates you are not registered or permitted to drive. Please update your profile.",
      error: `User profile for ${userId} (${clientProvidedFullName}) does not have 'canDrive' set to true (based on client-provided data).`
    };
  }
  console.log(`[Action: createActiveRydForEventAction_Step1] Driver ${userId} (${clientProvidedFullName}) is permitted to drive (based on client-provided status).`);

  // Step 3: Event details are now provided by the client (clientProvidedEventName)
  // The server-side fetch for event details is removed for this step.
  // let eventDetails: EventData | null = null; // Not needed
  let eventNameForMessage = clientProvidedEventName || `event ID ${validatedData.eventId}`; // Use client-provided name

  // If we reach here, driver check passed (using client data) and event name is available from client.
  // Further steps (like creating activeRydz document) would go here in a later step.
  // For now, we'll return success.

  const successMessage = `Step 3 successful! Offer from ${clientProvidedFullName} (${userId}) for event "${eventNameForMessage}" with ${validatedData.seatsAvailable} seats received. Event name confirmed via client. Notes: ${validatedData.notes || 'N/A'}`;
  console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);

  return {
    success: true,
    message: successMessage,
  };
}
