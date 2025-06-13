
'use server';
console.log("[File: activeRydActions.ts] File loaded on server."); // Top-level file load log

import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { type EventData, type UserProfileData, UserRole, type ActiveRyd, ActiveRydStatus } from '@/types';
import * as z from 'zod';
import { offerDriveFormServerSchema, type OfferDriveFormServerValues } from '@/schemas/activeRydSchemas';


export async function createActiveRydForEventAction(
  userId: string,
  data: OfferDriveFormServerValues
): Promise<{ success: boolean; activeRydId?: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction] Action called."); // First log in the action

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction] Error: userId not provided to action.");
    return { success: false, error: "User ID not provided. Authentication failed." };
  }
  console.log(`[Action: createActiveRydForEventAction] Processing for userId: ${userId}`, "with data:", JSON.stringify(data, null, 2));


  const validationResult = offerDriveFormServerSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction] Server-side validation of input data failed:", validationResult.error.flatten());
    return { success: false, error: "Invalid form data submitted to server action.", issues: validationResult.error.issues };
  }
  console.log("[Action: createActiveRydForEventAction] Server-side input data validation successful.");

  const { eventId, seatsAvailable, departureTime, startLocationAddress, pickupInstructions } = validationResult.data;

  try {
    console.log("[Action: createActiveRydForEventAction] Attempting to fetch driver profile...");
    const driverProfileRef = doc(db, "users", userId);
    const driverProfileSnap = await getDoc(driverProfileRef);

    if (!driverProfileSnap.exists()) {
      console.error(`[Action: createActiveRydForEventAction] Driver profile not found for userId: ${userId}`);
      return { success: false, error: "Driver profile not found. Ensure the user exists in Firestore." };
    }
    const driverProfile = driverProfileSnap.data() as UserProfileData;
    console.log("[Action: createActiveRydForEventAction] Fetched driverProfile:", JSON.stringify(driverProfile, null, 2));
    console.log(`[Action: createActiveRydForEventAction] Checking driverProfile.canDrive: ${driverProfile.canDrive}`);


    if (!driverProfile.canDrive) {
      console.error(`[Action: createActiveRydForEventAction] User ${userId} is not registered as a driver. Profile 'canDrive': ${driverProfile.canDrive}`);
      return { success: false, error: "User is not registered as a driver. Please update your profile to indicate you can drive." };
    }
    
    if (!driverProfile.driverDetails || !driverProfile.driverDetails.primaryVehicle || driverProfile.driverDetails.primaryVehicle.trim() === "") {
        console.error(`[Action: createActiveRydForEventAction] User ${userId} 's primary vehicle is not set or is empty. driverDetails:`, driverProfile.driverDetails);
        return { success: false, error: "Driver's primary vehicle is not set or is empty in their profile. Please update your profile." };
    }

    let vehicleMake = "N/A";
    let vehicleModel = "N/A";
    const primaryVehicle = driverProfile.driverDetails.primaryVehicle; 

    if (primaryVehicle && primaryVehicle.trim() !== "") {
        const parts = primaryVehicle.split(' ');
        vehicleMake = parts[0]; 
        vehicleModel = parts.length > 1 ? parts.slice(1).join(' ') : "N/A"; 
        if (vehicleMake === "N/A" && vehicleModel === "N/A" && primaryVehicle.trim() !== "N/A") { 
             vehicleMake = primaryVehicle; 
        }
    }
    console.log(`[Action: createActiveRydForEventAction] Parsed vehicle: Make - ${vehicleMake}, Model - ${vehicleModel}`);


    console.log("[Action: createActiveRydForEventAction] Attempting to fetch event data for eventId:", eventId);
    const eventDocRef = doc(db, "events", eventId);
    const eventDocSnap = await getDoc(eventDocRef);
    if (!eventDocSnap.exists()) {
        console.error(`[Action: createActiveRydForEventAction] Event not found for eventId: ${eventId}`);
        return { success: false, error: "Event not found. Cannot offer drive for a non-existent event." };
    }
    const eventData = eventDocSnap.data() as EventData;
    console.log("[Action: createActiveRydForEventAction] Fetched eventData:", JSON.stringify(eventData, null, 2));

    if (!eventData.location || eventData.location.trim() === "") {
      console.error(`[Action: createActiveRydForEventAction] Event (ID: ${eventId}) is missing a location. Cannot set finalDestinationAddress.`);
      return { success: false, error: "The selected event does not have a location specified. Please update the event details." };
    }


    const eventDate = eventData.eventTimestamp.toDate();

    const [hours, minutes] = departureTime.split(':').map(Number);
    const actualDepartureDateTime = new Date(eventDate);
    actualDepartureDateTime.setHours(hours, minutes, 0, 0);

    const finalStartLocationAddress = startLocationAddress && startLocationAddress.trim() !== ""
      ? startLocationAddress
      : driverProfile.address?.city || driverProfile.address?.zip || "Driver's general area"; // Fallback must be non-empty for rules
    console.log(`[Action: createActiveRydForEventAction] Final start location: ${finalStartLocationAddress}`);


    const activeRydPayload: Omit<ActiveRyd, 'id'> = {
      driverId: userId,
      associatedEventId: eventId,
      status: ActiveRydStatus.PLANNING,
      vehicleDetails: {
        make: vehicleMake,
        model: vehicleModel,
        passengerCapacity: String(seatsAvailable), // Rules expect string "1"-"8"
      },
      passengerManifest: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      actualDepartureTime: Timestamp.fromDate(actualDepartureDateTime),
      startLocationAddress: finalStartLocationAddress,
      finalDestinationAddress: eventData.location, // Checked above to be non-empty
      notes: pickupInstructions || "", 
    };
    // Remove serverTimestamps for logging actual payload being sent for rule evaluation
    const payloadForLogging = {...activeRydPayload};
    delete (payloadForLogging as any).createdAt; // Firestore handles serverTimestamp
    delete (payloadForLogging as any).updatedAt; // Firestore handles serverTimestamp
    console.log("====================================================================================");
    console.log("[Action: createActiveRydForEventAction] FINAL ActiveRyd payload for Firestore (before addDoc, excluding serverTimestamps):", JSON.stringify(payloadForLogging, null, 2));
    console.log("====================================================================================");

    try {
        console.log(`[Action: createActiveRydForEventAction] Attempting addDoc to 'activeRydz' collection now...`);
        const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);
        console.log(`[Action: createActiveRydForEventAction] SUCCESS! ActiveRyd created with ID: ${activeRydDocRef.id}`);
        return { success: true, activeRydId: activeRydDocRef.id };
    } catch (firestoreError: any) {
        console.error(`\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
        console.error(`[Action: createActiveRydForEventAction] CAUGHT FIRESTORE ERROR during addDoc to 'activeRydz'.`);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Code:`, firestoreError.code);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Message:`, firestoreError.message);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Stack:`, firestoreError.stack);
        console.error(`[Action: createActiveRydForEventAction] Full Firestore Error Object:`, JSON.stringify(firestoreError, Object.getOwnPropertyNames(firestoreError), 2));
        console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n`);
        
        let detailedMessage = "Firestore operation failed. ";
        if (firestoreError.code) {
            detailedMessage += `Code: ${firestoreError.code}. `;
        }
        if (firestoreError.message === 'Missing or insufficient permissions.') {
            detailedMessage += `Message: ${firestoreError.message}. This indicates a security rule violation. Please double-check: 1) The driver's profile has 'canDrive: true'. 2) The event has a valid location. 3) The submitted payload (see server logs) matches Firestore rule expectations for 'activeRydz' creation.`;
        } else if (firestoreError.message) {
            detailedMessage += `Message: ${firestoreError.message}. `;
        } else {
            detailedMessage += `Details: ${String(firestoreError)}. `;
        }
        
        console.error(`[Action: createActiveRydForEventAction] Constructed Firestore error message for client: ${detailedMessage}`);
        return { success: false, error: detailedMessage };
    }

  } catch (error: any) {
    console.error(`\n\n************************************************************************************`);
    console.error("[Action: createActiveRydForEventAction] CRITICAL GENERAL ERROR (outer catch):", error.message);
    console.error("[Action: createActiveRydForEventAction] Error Name:", error.name);
    console.error("[Action: createActiveRydForEventAction] Error Stack:", error.stack);
    console.error("[Action: createActiveRydForEventAction] Full General Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`************************************************************************************\n\n`);
    
    let generalErrorMessage = "Could not submit drive offer due to an unexpected server error.";
    if (error.message) {
        generalErrorMessage = error.message;
         if (error.message === 'Missing or insufficient permissions.') {
             generalErrorMessage = "Submission failed: Missing or insufficient permissions. This likely indicates a Firestore security rule prevented the operation. Please check your user profile (e.g., 'canDrive' status) and the Firestore rules.";
         }
    }
    if (error instanceof TypeError) {
        generalErrorMessage = `A TypeError occurred: ${error.message}. This might be due to missing profile data (like 'driverDetails' or event 'location') or an internal coding error. Please check your profile details and the event details.`;
    }
    console.error(`[Action: createActiveRydForEventAction] Constructed General error message for client: ${generalErrorMessage}`);
    return { success: false, error: generalErrorMessage };
  }
}
