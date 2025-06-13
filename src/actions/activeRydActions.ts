
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
  console.log("[Action: createActiveRydForEventAction] Action called.");

  if (!userId) {
    console.error("[Action: createActiveRydForEventAction] Error: userId not provided to action.");
    return { success: false, error: "User ID not provided." };
  }
  console.log(`[Action: createActiveRydForEventAction] Processing for userId: ${userId}`, "with data:", data);


  const validationResult = offerDriveFormServerSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("[Action: createActiveRydForEventAction] Server-side validation failed:", validationResult.error.flatten());
    return { success: false, error: "Invalid form data.", issues: validationResult.error.issues };
  }
  console.log("[Action: createActiveRydForEventAction] Server-side validation successful.");

  const { eventId, seatsAvailable, departureTime, startLocationAddress, pickupInstructions } = validationResult.data;

  try {
    console.log("[Action: createActiveRydForEventAction] Attempting to fetch driver profile...");
    const driverProfileRef = doc(db, "users", userId);
    const driverProfileSnap = await getDoc(driverProfileRef);

    if (!driverProfileSnap.exists()) {
      console.error(`[Action: createActiveRydForEventAction] Driver profile not found for userId: ${userId}`);
      return { success: false, error: "Driver profile not found." };
    }
    const driverProfile = driverProfileSnap.data() as UserProfileData;
    console.log("[Action: createActiveRydForEventAction] Fetched driverProfile:", JSON.stringify(driverProfile, null, 2));


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
    const primaryVehicle = driverProfile.driverDetails.primaryVehicle; // Safe due to check above

    if (primaryVehicle) { 
        const parts = primaryVehicle.split(' ');
        vehicleMake = parts[0] || "N/A"; 
        vehicleModel = parts.length > 1 ? parts.slice(1).join(' ') : "N/A"; 
        if (vehicleMake === "N/A" && vehicleModel === "N/A" && primaryVehicle.trim() !== "N/A") { 
             vehicleMake = primaryVehicle; 
        }
    }
    console.log(`[Action: createActiveRydForEventAction] Parsed vehicle: Make - ${vehicleMake}, Model - ${vehicleModel}`);


    console.log("[Action: createActiveRydForEventAction] Attempting to fetch event data...");
    const eventDocRef = doc(db, "events", eventId);
    const eventDocSnap = await getDoc(eventDocRef);
    if (!eventDocSnap.exists()) {
        console.error(`[Action: createActiveRydForEventAction] Event not found for eventId: ${eventId}`);
        return { success: false, error: "Event not found." };
    }
    const eventData = eventDocSnap.data() as EventData;
    console.log("[Action: createActiveRydForEventAction] Fetched eventData:", JSON.stringify(eventData, null, 2));

    const eventDate = eventData.eventTimestamp.toDate();

    const [hours, minutes] = departureTime.split(':').map(Number);
    const actualDepartureDateTime = new Date(eventDate);
    actualDepartureDateTime.setHours(hours, minutes, 0, 0);

    const finalStartLocationAddress = startLocationAddress && startLocationAddress.trim() !== ""
      ? startLocationAddress
      : driverProfile.address?.city || driverProfile.address?.zip || "Driver's general area";
    console.log(`[Action: createActiveRydForEventAction] Final start location: ${finalStartLocationAddress}`);


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
    // Remove serverTimestamps for logging actual payload being sent for rule evaluation
    const payloadForLogging = {...activeRydPayload};
    delete (payloadForLogging as any).createdAt;
    delete (payloadForLogging as any).updatedAt;
    console.log("[Action: createActiveRydForEventAction] Final ActiveRyd payload (before addDoc, excluding serverTimestamps):", JSON.stringify(payloadForLogging, null, 2));

    try {
        console.log(`[Action: createActiveRydForEventAction] About to call addDoc with Firestore.`);
        const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);
        console.log(`[Action: createActiveRydForEventAction] ActiveRyd created successfully with ID: ${activeRydDocRef.id}`);
        return { success: true, activeRydId: activeRydDocRef.id };
    } catch (firestoreError: any) {
        console.error(`[Action: createActiveRydForEventAction] CAUGHT FIRESTORE ERROR during addDoc.`);
        console.error(`[Action: createActiveRydForEventAction] Raw Firestore Error Object:`, firestoreError);
        
        let detailedMessage = "Firestore operation failed. ";
        if (typeof firestoreError === 'object' && firestoreError !== null) {
            if (firestoreError.code) {
                detailedMessage += `Code: ${firestoreError.code}. `;
            }
            // If the raw message is 'Missing or insufficient permissions.', provide context.
            if (firestoreError.message === 'Missing or insufficient permissions.') {
                 detailedMessage += `Message: ${firestoreError.message}. This usually means a security rule was violated. Please check driver 'canDrive' status and Firestore rules for 'activeRydz' collection.`;
            } else if (firestoreError.message) {
                detailedMessage += `Message: ${firestoreError.message}. `;
            } else if (Object.keys(firestoreError).length === 0 && firestoreError.toString) {
                 detailedMessage += `Details: ${firestoreError.toString()}. `;
            } else {
                 detailedMessage += `No standard message/code found in error. `;
            }
        } else {
            detailedMessage += `Details: ${String(firestoreError)}. `;
        }
        detailedMessage += "If server logs are available, check them for payload details and rule evaluation specifics.";
        
        console.error(`[Action: createActiveRydForEventAction] Constructed Firestore error message for client: ${detailedMessage}`);
        return { success: false, error: detailedMessage };
    }

  } catch (error: any) {
    console.error("[Action: createActiveRydForEventAction] General error (outer catch):", error);
    console.error("[Action: createActiveRydForEventAction] General error object stringified:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    let generalErrorMessage = "Could not submit drive offer due to an unexpected error.";
    if (error.message) {
        generalErrorMessage = error.message;
         if (error.message === 'Missing or insufficient permissions.') {
             generalErrorMessage = "Submission failed: Missing or insufficient permissions. This likely indicates a Firestore security rule prevented the operation. Please check your user profile (e.g., 'canDrive' status) and the Firestore rules.";
         }
    }
    if (error instanceof TypeError) {
        generalErrorMessage = `A TypeError occurred: ${error.message}. This might be due to missing profile data or an internal coding error. Please check your profile details.`;
    }
    console.error(`[Action: createActiveRydForEventAction] Constructed General error message for client: ${generalErrorMessage}`);
    return { success: false, error: generalErrorMessage };
  }
}
