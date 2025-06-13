
'use server';

import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { type EventData, type UserProfileData, UserRole, type ActiveRyd, ActiveRydStatus } from '@/types';
import * as z from 'zod';
import { offerDriveFormServerSchema, type OfferDriveFormServerValues } from '@/schemas/activeRydSchemas';


export async function createActiveRydForEventAction(
  data: OfferDriveFormServerValues
): Promise<{ success: boolean; activeRydId?: string; error?: string; issues?: z.ZodIssue[] }> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    return { success: false, error: "User not authenticated." };
  }

  // Validate input data with the server-side schema
  const validationResult = offerDriveFormServerSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: "Invalid form data.", issues: validationResult.error.issues };
  }

  const { eventId, seatsAvailable, departureTime, startLocationAddress, pickupInstructions } = validationResult.data;

  try {
    // Fetch driver's profile for vehicle details and to confirm they can drive
    const driverProfileRef = doc(db, "users", firebaseUser.uid);
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

    // Fetch event details to ensure it exists and get its date
    const eventDocRef = doc(db, "events", eventId);
    const eventDocSnap = await getDoc(eventDocRef);
    if (!eventDocSnap.exists()) {
        return { success: false, error: "Event not found." };
    }
    const eventData = eventDocSnap.data() as EventData;
    const eventDate = eventData.eventTimestamp.toDate(); // This is the actual event date

    // Combine event date with driver's offered departure time
    const [hours, minutes] = departureTime.split(':').map(Number);
    const actualDepartureDateTime = new Date(eventDate); // Start with the event's date
    actualDepartureDateTime.setHours(hours, minutes, 0, 0);

    const finalStartLocationAddress = startLocationAddress && startLocationAddress.trim() !== ""
      ? startLocationAddress
      : driverProfile.address?.city || driverProfile.address?.zip || "Driver's general area";

    const activeRydPayload: Omit<ActiveRyd, 'id'> = {
      driverId: firebaseUser.uid,
      associatedEventId: eventId,
      status: ActiveRydStatus.PLANNING, 
      vehicleDetails: {
        make: driverProfile.driverDetails.primaryVehicle?.split(' ')[0] || "", 
        model: driverProfile.driverDetails.primaryVehicle?.split(' ').slice(1).join(' ') || "", 
        passengerCapacity: String(seatsAvailable), 
      },
      passengerManifest: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      actualDepartureTime: Timestamp.fromDate(actualDepartureDateTime),
      startLocationAddress: finalStartLocationAddress,
      finalDestinationAddress: eventData.location,
      notes: pickupInstructions,
    };

    const activeRydDocRef = await addDoc(collection(db, "activeRydz"), activeRydPayload);

    return { success: true, activeRydId: activeRydDocRef.id };

  } catch (error: any) {
    console.error("Error creating ActiveRyd for event:", error);
    return { success: false, error: error.message || "Could not submit drive offer." };
  }
}
