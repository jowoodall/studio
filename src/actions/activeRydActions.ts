
'use server';

import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { type EventData, type UserProfileData, UserRole, type ActiveRyd, ActiveRydStatus } from '@/types';
import * as z from 'zod';
import { offerDriveFormServerSchema, type OfferDriveFormServerValues } from '@/schemas/activeRydSchemas';


export async function createActiveRydForEventAction(
  userId: string,
  data: OfferDriveFormServerValues
): Promise<{ success: boolean; activeRydId?: string; error?: string; issues?: z.ZodIssue[] }> {
  console.log("[Action: createActiveRydForEventAction] Action called."); // New top-level log

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
      return { success: false, error: "User is not registered as a driver." };
    }
    
    if (!driverProfile.driverDetails || !driverProfile.driverDetails.primaryVehicle || driverProfile.driverDetails.primaryVehicle.trim() === "") {
        console.error(`[Action: createActiveRydForEventAction] User ${userId} 's primary vehicle is not set or is empty. driverDetails:`, driverProfile.driverDetails);
        return { success: false, error: "Driver's primary vehicle is not set or is empty in their profile. Please update your profile." };
    }

    let vehicleMake = "N/A";
    let vehicleModel = "N/A";
    const primaryVehicle = driverProfile.driverDetails.primaryVehicle;

    if (primaryVehicle) { // This check is now safe because we ensured driverProfile.driverDetails.primaryVehicle exists and is non-empty above
        const parts = primaryVehicle.split(' ');
        vehicleMake = parts[0] || "N/A"; // Ensure fallback if split results in empty string
        vehicleModel = parts.length > 1 ? parts.slice(1).join(' ') : "N/A"; // Ensure fallback
        if (vehicleMake === "N/A" && vehicleModel === "N/A" && primaryVehicle.trim() !== "N/A") { 
             vehicleMake = primaryVehicle; 
        }
    }
    console.log(`[Action: createActiveRydForEventAction] Parsed vehicle: Make - ${vehicleMake}, Model - ${vehicleModel}`);


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

    console.log("[Action: createActiveRydForEventAction] Final ActiveRyd payload before addDoc:", JSON.stringify(activeRydPayload, null, 2));

    try {
        const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);
        console.log(`[Action: createActiveRydForEventAction] ActiveRyd created successfully with ID: ${activeRydDocRef.id}`);
        return { success: true, activeRydId: activeRydDocRef.id };
    } catch (firestoreError: any) {
        console.error("[Action: createActiveRydForEventAction] Firestore error creating ActiveRyd:", JSON.stringify(firestoreError, Object.getOwnPropertyNames(firestoreError)));
        let errorMessage = "An unknown Firestore error occurred while creating ActiveRyd.";
        if (firestoreError.message) {
            errorMessage = firestoreError.message;
        }
        let errorCode = "UNKNOWN";
        if (firestoreError.code) {
            errorCode = firestoreError.code;
        }
        console.error("Firestore error code:", errorCode);
        console.error("Firestore error message:", errorMessage);
        return { success: false, error: `Firestore operation failed: ${errorMessage} (Code: ${errorCode}). Check server logs for payload details and verify Firestore rules.` };
    }

  } catch (error: any) {
    console.error("[Action: createActiveRydForEventAction] General error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    let generalErrorMessage = "Could not submit drive offer due to an unexpected error.";
    if (error.message) {
        generalErrorMessage = error.message;
    }
    if (error instanceof TypeError) {
        generalErrorMessage = `A TypeError occurred: ${error.message}. This might be due to missing profile data or an internal coding error.`;
    }
    return { success: false, error: generalErrorMessage };
  }
}
