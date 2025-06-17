
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 3 - Re-fetching event details).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
import { db } from '@/lib/firebase'; // Re-add db import
import { doc, getDoc, type Timestamp } from 'firebase/firestore'; // Re-add getDoc and Timestamp
import type { EventData } from '@/types'; // Re-add EventData type

export async function createActiveRydForEventAction_Step1(
  userId: string,
  data: OfferDriveFormStep1Values,
  clientProvidedFullName: string,
  clientProvidedCanDrive: boolean
): Promise<{ success: boolean; message: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called (Step 3 - Re-fetching event details).");

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
  const validatedData = validationResult.data;
  console.log("[Action: createActiveRydForEventAction_Step1] Server-side input data validation successful.");

  // Driver permission check (still using client-provided data for this step)
  if (!clientProvidedCanDrive) {
    console.error(`[Action: createActiveRydForEventAction_Step1] User ${userId} (${clientProvidedFullName}) is not permitted to drive based on client-provided status.`);
    return {
      success: false,
      message: "Your profile indicates you are not registered or permitted to drive. Please update your profile.",
      error: `User profile for ${userId} (${clientProvidedFullName}) does not have 'canDrive' set to true (based on client-provided data).`
    };
  }
  console.log(`[Action: createActiveRydForEventAction_Step1] Driver ${userId} (${clientProvidedFullName}) is permitted to drive (based on client-provided status).`);

  // Step 3: Attempt to fetch event details
  let eventDetails: EventData | null = null;
  let eventNameForMessage = `event ID ${validatedData.eventId}`;
  try {
    console.log(`[Action: createActiveRydForEventAction_Step1] Attempting to fetch event details for eventId: ${validatedData.eventId}`);
    const eventDocRef = doc(db, "events", validatedData.eventId);
    const eventDocSnap = await getDoc(eventDocRef);

    if (eventDocSnap.exists()) {
      eventDetails = eventDocSnap.data() as EventData;
      eventNameForMessage = eventDetails.name || eventNameForMessage;
      console.log(`[Action: createActiveRydForEventAction_Step1] Successfully fetched event: ${eventDetails.name}`);
    } else {
      console.error(`[Action: createActiveRydForEventAction_Step1] Event with ID "${validatedData.eventId}" not found in Firestore.`);
      return {
        success: false,
        message: "Event details could not be found.",
        error: `Event with ID "${validatedData.eventId}" does not exist.`,
      };
    }
  } catch (e: any) {
    console.error(`[Action: createActiveRydForEventAction_Step1] Error fetching event details for eventId ${validatedData.eventId}:`, e);
    let specificError = `Failed to fetch event details for event ID ${validatedData.eventId}.`;
    if (e.code === 'permission-denied') {
      specificError += " This indicates a Firestore read permission issue. Please check your Firestore rules for the '/events' collection and ensure the server authentication context allows reading this document.";
    } else {
      specificError += ` (Error: ${e.message || 'Unknown Firestore error'})`;
    }
    return {
      success: false,
      message: "An error occurred while fetching event information.",
      error: specificError,
    };
  }

  // If we reach here, driver check passed (using client data) and event details were fetched.
  // Further steps (like creating activeRydz document) would go here.
  // For now, we'll return success.

  const successMessage = `Step 3 successful! Offer from ${clientProvidedFullName} (${userId}) for event "${eventNameForMessage}" with ${validatedData.seatsAvailable} seats received. Event details fetched. Notes: ${validatedData.notes || 'N/A'}`;
  console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);

  return {
    success: true,
    message: successMessage,
  };
}
