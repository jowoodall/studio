
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
  if (!userId) {
    return { success: false, error: "User ID not provided." };
  }

  const validationResult = offerDriveFormServerSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: "Invalid form data.", issues: validationResult.error.issues };
  }

  const { eventId, seatsAvailable, departureTime, startLocationAddress, pickupInstructions } = validationResult.data;

  try {
    const driverProfileRef = doc(db, "users", userId);
    const driverProfileSnap = await getDoc(driverProfileRef);

    if (!driverProfileSnap.exists()) {
      return { success: false, error: "Driver profile not found." };
    }
    const driverProfile = driverProfileSnap.data() as UserProfileData;

    if (!driverProfile.canDrive) {
      return { success: false, error: "User is not registered as a driver." };
    }
    
    // Safely check for driverDetails and primaryVehicle first
    if (!driverProfile.driverDetails || !driverProfile.driverDetails.primaryVehicle || driverProfile.driverDetails.primaryVehicle.trim() === "") {
        return { success: false, error: "Driver's primary vehicle is not set or is empty in their profile. Please update your profile." };
    }

    let vehicleMake = "N/A";
    let vehicleModel = "N/A";
    const primaryVehicle = driverProfile.driverDetails.primaryVehicle;

    if (primaryVehicle) {
        const parts = primaryVehicle.split(' ');
        vehicleMake = parts[0] || "N/A";
        vehicleModel = parts.length > 1 ? parts.slice(1).join(' ') : "N/A";
        if (vehicleMake === "N/A" && vehicleModel === "N/A") { // if split resulted in N/A for both but vehicle string exists
             vehicleMake = primaryVehicle; // Use the full string as make
        }
    }


    const eventDocRef = doc(db, "events", eventId);
    const eventDocSnap = await getDoc(eventDocRef);
    if (!eventDocSnap.exists()) {
        return { success: false, error: "Event not found." };
    }
    const eventData = eventDocSnap.data() as EventData;
    const eventDate = eventData.eventTimestamp.toDate();

    const [hours, minutes] = departureTime.split(':').map(Number);
    const actualDepartureDateTime = new Date(eventDate);
    actualDepartureDateTime.setHours(hours, minutes, 0, 0);

    const finalStartLocationAddress = startLocationAddress && startLocationAddress.trim() !== ""
      ? startLocationAddress
      : driverProfile.address?.city || driverProfile.address?.zip || "Driver's general area";


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

    console.log("[Action: createActiveRydForEvent] Attempting to create ActiveRyd with payload:", JSON.stringify(activeRydPayload, null, 2));

    try {
        const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);
        return { success: true, activeRydId: activeRydDocRef.id };
    } catch (firestoreError: any) {
        console.error("[Action: createActiveRydForEvent] Firestore error creating ActiveRyd:", firestoreError);
        let errorMessage = "An unknown Firestore error occurred.";
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
    console.error("[Action: createActiveRydForEvent] General error:", error);
    let generalErrorMessage = "Could not submit drive offer due to an unexpected error.";
    if (error.message) {
        generalErrorMessage = error.message;
    }
    // If it's a TypeError, it's likely a programming error accessing properties of undefined
    if (error instanceof TypeError) {
        generalErrorMessage = `A TypeError occurred: ${error.message}. This might be due to missing profile data.`;
    }
    return { success: false, error: generalErrorMessage };
  }
}
