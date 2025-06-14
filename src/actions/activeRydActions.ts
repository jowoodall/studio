
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
      console.error(`[Action: createActiveRydForEventAction] CRITICAL: Event (ID: ${eventId}) is missing a location. This will cause Firestore rule failure for 'finalDestinationAddress'.`);
      return { success: false, error: "The selected event does not have a location specified. Please update the event details as this is required to offer a ryd." };
    }


    const eventDate = eventData.eventTimestamp.toDate();

    const [hours, minutes] = departureTime.split(':').map(Number);
    const actualDepartureDateTime = new Date(eventDate);
    actualDepartureDateTime.setHours(hours, minutes, 0, 0);

    const finalStartLocationAddress = startLocationAddress && startLocationAddress.trim() !== ""
      ? startLocationAddress.trim()
      : (driverProfile.address?.city && driverProfile.address.city.trim() !== "" ? driverProfile.address.city.trim() : 
        (driverProfile.address?.zip && driverProfile.address.zip.trim() !== "" ? driverProfile.address.zip.trim() : "Driver's general area"));
    
    console.log(`[Action: createActiveRydForEventAction] Determined finalStartLocationAddress: "${finalStartLocationAddress}"`);
    
    if (!finalStartLocationAddress || finalStartLocationAddress.trim() === "") {
      console.error(`[Action: createActiveRydForEventAction] CRITICAL: finalStartLocationAddress resolved to an empty string. This will cause Firestore rule failure for 'startLocationAddress'. Profile Address: City: ${driverProfile.address?.city}, Zip: ${driverProfile.address?.zip}. Form Input: '${startLocationAddress}'`);
      return { success: false, error: "Could not determine a valid start location address for the ryd. Please ensure your profile has a city/zip or specify a start address in the form." };
    }


    const activeRydPayload: Omit<ActiveRyd, 'id'> = {
      driverId: userId,
      associatedEventId: eventId,
      status: ActiveRydStatus.PLANNING,
      vehicleDetails: {
        make: vehicleMake,
        model: vehicleModel,
        passengerCapacity: String(seatsAvailable), 
      },
      passengerManifest: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      actualDepartureTime: Timestamp.fromDate(actualDepartureDateTime),
      startLocationAddress: finalStartLocationAddress,
      finalDestinationAddress: eventData.location, 
      notes: pickupInstructions || "", 
    };
    
    const payloadForLogging = {...activeRydPayload};
    delete (payloadForLogging as any).createdAt; 
    delete (payloadForLogging as any).updatedAt;
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
        if (firestoreError.message === 'Missing or insufficient permissions.' || firestoreError.code === 'permission-denied') {
            detailedMessage += `Message: ${firestoreError.message}. This indicates a security rule violation. Please double-check: 
1) The driver's profile (UID: ${userId}) has 'canDrive: true'. 
2) The event (ID: ${eventId}) has a valid, non-empty location. 
3) The start location (either from form or profile fallback) is non-empty.
4) The vehicle capacity (seats) is between 1 and 8.
5) The submitted payload (see server logs if visible) matches Firestore rule expectations for 'activeRydz' creation.`;
        } else if (firestoreError.message) {
            detailedMessage += `Message: ${firestoreError.message}. `;
        } else {
            detailedMessage += `Details: ${String(firestoreError)}. `;
        }
        // Append the stringified full error for client debugging
        detailedMessage += ` | Full Error (Server): ${JSON.stringify(firestoreError, Object.getOwnPropertyNames(firestoreError))}`;
        
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
         if (error.message === 'The selected event does not have a location specified. Please update the event details as this is required to offer a ryd.' ||
             error.message === "Could not determine a valid start location address for the ryd. Please ensure your profile has a city/zip or specify a start address in the form." ||
             error.message === "Driver's primary vehicle is not set or is empty in their profile. Please update your profile.") {
            // Return specific pre-check errors directly
         } else if (error.message === 'Missing or insufficient permissions.') {
             generalErrorMessage = "Submission failed: Missing or insufficient permissions. This likely indicates a Firestore security rule prevented the operation. Please check your user profile (e.g., 'canDrive' status), the event details (e.g., location), and the Firestore rules.";
         }
    }
    if (error instanceof TypeError && !generalErrorMessage.startsWith("A TypeError occurred:")) { 
        generalErrorMessage = `A TypeError occurred: ${error.message}. This might be due to missing profile data (like 'driverDetails.primaryVehicle' or event 'location') or an internal coding error. Please check your profile details and the event details. Ensure the user profile for UID '${userId}' and event '${eventId}' exist and are complete.`;
    }
    console.error(`[Action: createActiveRydForEventAction] Constructed General error message for client: ${generalErrorMessage}`);
    return { success: false, error: generalErrorMessage };
  }
}
    