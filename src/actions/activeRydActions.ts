
'use server';
console.log("[File: activeRydActions.ts] File loaded on server (Step 4 - Attempting Firestore write for activeRydz).");

import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ActiveRyd, ActiveRydStatus } from '@/types'; // Added ActiveRyd types

export async function createActiveRydForEventAction_Step1(
  userId: string,
  data: OfferDriveFormStep1Values,
  clientProvidedFullName: string,
  clientProvidedCanDrive: boolean,
  clientProvidedEventName: string
): Promise<{ success: boolean; message: string; error?: string; issues?: z.ZodIssue[]; activeRydId?: string }> {
  console.log("[Action: createActiveRydForEventAction_Step1] Action called (Step 4 - Attempting Firestore write for activeRydz).");

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

  // Step 2: Driver permission check (using client-provided data)
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
  const eventNameForMessage = clientProvidedEventName || `event ID ${validatedData.eventId}`;

  // Step 4: Attempt to create the activeRydz document in Firestore
  console.log(`[Action: createActiveRydForEventAction_Step1] Attempting to create activeRydz document for eventId: ${validatedData.eventId}, driverId: ${userId}`);
  
  const activeRydObject: Omit<ActiveRyd, 'id' | 'updatedAt'> = {
    driverId: userId,
    status: 'planning' as ActiveRydStatus.PLANNING, // Initial status
    createdAt: serverTimestamp() as Timestamp,
    passengerManifest: [], // Start with an empty manifest
    associatedEventId: validatedData.eventId,
    notes: validatedData.notes || "", // From form
    // Optional: Add minimal vehicle details if available and needed by rules, or set to empty/default
    vehicleDetails: {
        passengerCapacity: String(validatedData.seatsAvailable) || "0", // Use form seats for now
    },
    // Other fields like actualDepartureTime, finalDestinationAddress can be set later
    finalDestinationAddress: "", // Placeholder, ideally this comes from event details
    startLocationAddress: "", // Placeholder, driver might set this
  };
  
  try {
    const activeRydzCollectionRef = collection(db, "activeRydz");
    const docRef = await addDoc(activeRydzCollectionRef, activeRydObject);
    console.log(`[Action: createActiveRydForEventAction_Step1] Successfully created activeRydz document with ID: ${docRef.id}`);
    
    const successMessage = `Step 4 successful! Offer from ${clientProvidedFullName} (${userId}) for event "${eventNameForMessage}" created. ActiveRyd ID: ${docRef.id}.`;
    console.log(`[Action: createActiveRydForEventAction_Step1] ${successMessage}`);

    return {
      success: true,
      message: successMessage,
      activeRydId: docRef.id,
    };

  } catch (e: any) {
    console.error(`[Action: createActiveRydForEventAction_Step1] CRITICAL ERROR creating activeRydz document for eventId ${validatedData.eventId}, driverId ${userId}:`, e);
    let errorMessage = "Failed to create the ryd offer in Firestore.";
    if (e.code === 'permission-denied') {
      errorMessage = `Firestore permission denied when trying to create activeRydz document. This likely means the server's authentication context (request.auth) is not correctly set or does not meet the 'create' rule criteria for '/activeRydz'. (Error Code: ${e.code})`;
    } else {
      errorMessage = `An unexpected error occurred while creating the ryd offer: ${e.message || 'Unknown Firestore error'}. (Error Code: ${e.code || 'N/A'})`;
    }
    console.error("[Action: createActiveRydForEventAction_Step1] Full error object:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    return {
      success: false,
      message: "An error occurred while creating your ryd offer.",
      error: errorMessage,
    };
  }
}
