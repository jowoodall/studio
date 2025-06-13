
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
    if (!driverProfile.driverDetails?.primaryVehicle) {
        return { success: false, error: "Driver's primary vehicle is not set in their profile." };
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

    let vehicleMake = driverProfile.driverDetails.primaryVehicle?.split(' ')[0] || "N/A";
    let vehicleModel = driverProfile.driverDetails.primaryVehicle?.split(' ').slice(1).join(' ') || "N/A";
    if (vehicleMake === "N/A" && vehicleModel === "N/A" && driverProfile.driverDetails.primaryVehicle) {
        // If splitting didn't work but there is a primary vehicle string, use it as make.
        vehicleMake = driverProfile.driverDetails.primaryVehicle;
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
      updatedAt: serverTimestamp() as Timestamp, // Added updatedAt
      actualDepartureTime: Timestamp.fromDate(actualDepartureDateTime),
      startLocationAddress: finalStartLocationAddress,
      finalDestinationAddress: eventData.location,
      notes: pickupInstructions || "", // Ensure notes is always a string
    };

    // Log the payload for debugging on the server
    console.log("[Action: createActiveRydForEvent] Attempting to create ActiveRyd with payload:", JSON.stringify(activeRydPayload, null, 2));

    try {
        const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);
        return { success: true, activeRydId: activeRydDocRef.id };
    } catch (firestoreError: any) {
        // Log the detailed Firestore error on the server
        console.error("[Action: createActiveRydForEvent] Firestore error creating ActiveRyd:", firestoreError);
        console.error("Firestore error code:", firestoreError.code);
        console.error("Firestore error message:", firestoreError.message);
        // Return a more specific error to the client
        return { success: false, error: `Firestore operation failed: ${firestoreError.message} (Code: ${firestoreError.code}). Check server logs for payload details and verify Firestore rules.` };
    }

  } catch (error: any) {
    // This catch block handles errors from getDoc, etc., before the Firestore write attempt
    console.error("[Action: createActiveRydForEvent] General error:", error);
    return { success: false, error: error.message || "Could not submit drive offer due to an unexpected error." };
  }
}
