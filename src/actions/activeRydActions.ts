
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
        const errCode = firestoreError.code || 'UNKNOWN_CODE';
        const errMsg = firestoreError.message || 'No message';
        const errStack = firestoreError.stack || 'No stack';

        console.error(`\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
        console.error(`[Action: createActiveRydForEventAction] FIRESTORE ADD FAILURE in 'activeRydz'. UID: ${userId}, EventID: ${eventId}`);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Code: ${errCode}`);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Message: ${errMsg}`);
        console.error(`[Action: createActiveRydForEventAction] Firestore Error Stack: ${errStack}`);
        console.error(`[Action: createActiveRydForEventAction] Full Firestore Error Object:`, JSON.stringify(firestoreError, Object.getOwnPropertyNames(firestoreError), 2));
        console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n`);
        
        let detailedClientMessage = `Firestore Add Operation Failed. Code: ${errCode}. Message: ${errMsg}.`;
        if (errCode === 'permission-denied' || errMsg.toLowerCase().includes('permission denied') || errMsg.toLowerCase().includes('missing or insufficient permissions')) {
            detailedClientMessage += ` This indicates a Firestore security rule violation for 'activeRydz' creation. Please double-check these specific conditions in your Firestore rules and data:
1. Driver Profile (UID: ${userId}): The 'canDrive' field must be explicitly true.
2. Event Details (ID: ${eventId}): The 'location' field must be non-empty (this becomes 'finalDestinationAddress' in the ryd document).
3. Start Location: The 'startLocationAddress' (from form input '${startLocationAddress}' or profile fallback '${driverProfile.address?.city || driverProfile.address?.zip || "Driver's general area"}') must result in a non-empty string.
4. Vehicle Capacity: Seats offered ('${seatsAvailable}') must translate to a string between "1" and "8" in 'vehicleDetails.passengerCapacity'.
5. Payload Integrity: The data structure sent to Firestore must exactly match all rule conditions (field types, required fields, specific values like status='planning', empty passengerManifest).
Review the server-side logs (if visible) for the exact payload being sent to Firestore just before this error.`;
        }
        detailedClientMessage += ` | Full Raw Error (Server): ${JSON.stringify(firestoreError, Object.getOwnPropertyNames(firestoreError))}`;
        
        console.error(`[Action: createActiveRydForEventAction] Constructed INNER CATCH Firestore error message for client: ${detailedClientMessage}`);
        return { success: false, error: detailedClientMessage };
    }

  } catch (error: any) {
    console.error(`\n\n************************************************************************************`);
    console.error(`[Action: createActiveRydForEventAction] CRITICAL GENERAL ERROR (outer catch). UID: ${userId}. Error:`, error.message);
    console.error("[Action: createActiveRydForEventAction] Error Name:", error.name);
    console.error("[Action: createActiveRydForEventAction] Error Stack:", error.stack);
    console.error("[Action: createActiveRydForEventAction] Full General Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`************************************************************************************\n\n`);
    
    let generalErrorMessage = "Could not submit drive offer due to an unexpected server error.";
    const errorFullName = Object.prototype.toString.call(error);

    if (error.message) {
        if (error.message.startsWith("The selected event does not have a location specified") ||
            error.message.startsWith("Could not determine a valid start location address") ||
            error.message.startsWith("Driver's primary vehicle is not set or is empty")) {
            generalErrorMessage = error.message; // Pass through specific pre-check errors
        } else if (error.message === 'Missing or insufficient permissions.') {
             generalErrorMessage = `Submission failed (Outer Catch): Missing or insufficient permissions. This suggests an issue *before* the Firestore write attempt, or an unhandled Firestore error. UID: ${userId}. Key items to check:
1. Driver Profile (UID: ${userId}): 'canDrive' must be true.
2. Event (ID: ${eventId}): Must exist and have a non-empty 'location'.
3. Start Location: Must resolve to a non-empty string.
4. Primary Vehicle: Must be set in driver's profile.
Full error details if possible: Name: ${error.name}, Type: ${errorFullName}, Raw: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
        } else {
            generalErrorMessage = `Outer catch: ${error.message}. Type: ${errorFullName}. Raw: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
        }
    } else {
        generalErrorMessage = `Outer catch: An unknown error occurred. Type: ${errorFullName}. Raw: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
    }
    
    console.error(`[Action: createActiveRydForEventAction] Constructed OUTER CATCH General error message for client: ${generalErrorMessage}`);
    return { success: false, error: generalErrorMessage };
  }
}
    
