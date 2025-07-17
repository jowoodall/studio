
// src/app/api/offer-drive/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { offerDriveFormSchema } from '@/schemas/activeRydSchemas';
import admin from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData, EventData, ActiveRyd, RydData, RydStatus, PassengerManifestItem, RydDirection } from '@/types';
import { ActiveRydStatus, PassengerManifestStatus } from '@/types';

export async function POST(request: NextRequest) {
  console.log('[API Route: /api/offer-drive] POST request received.');
  try {
    const authorizationHeader = request.headers.get('X-Authorization-Id-Token');
    if (!authorizationHeader) {
      console.error('[API Route: /api/offer-drive] Missing X-Authorization-Id-Token header.');
      return NextResponse.json({ success: false, message: 'Unauthorized. No token provided.' }, { status: 401 });
    }

    const idToken = authorizationHeader;
    if (!idToken) {
      console.error('[API Route: /api/offer-drive] ID token is empty in X-Authorization-Id-Token header.');
      return NextResponse.json({ success: false, message: 'Unauthorized. Token is empty.' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log(`[API Route: /api/offer-drive] ID Token verified for UID: ${decodedToken.uid}`);
    } catch (error: any) {
      console.error('[API Route: /api/offer-drive] Error verifying ID Token:', error);
      return NextResponse.json({ success: false, message: `Authentication failed: ${error.message}`, errorDetails: error.code || 'unknown_auth_error' }, { status: 403 });
    }

    const verifiedUserId = decodedToken.uid;
    const body = await request.json();
    console.log('[API Route: /api/offer-drive] Received request body:', JSON.stringify(body, null, 2));

    const validationResult = offerDriveFormSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('[API Route: /api/offer-drive] Form data validation failed:', validationResult.error.flatten());
      return NextResponse.json({ success: false, message: "Invalid form data submitted to API.", issues: validationResult.error.issues }, { status: 400 });
    }
    const validatedData = validationResult.data;
    console.log('[API Route: /api/offer-drive] Form data successfully validated by Zod.');

    const db = admin.firestore();

    let userProfile: UserProfileData;
    try {
      const userDocRef = db.collection('users').doc(verifiedUserId);
      const userDocSnap = await userDocRef.get();
      if (!userDocSnap.exists) {
        console.error(`[API Route: /api/offer-drive] User profile not found in Firestore for UID: ${verifiedUserId}`);
        return NextResponse.json({ success: false, message: 'User profile not found. Cannot verify driver status.' }, { status: 404 });
      }
      userProfile = userDocSnap.data() as UserProfileData;
      console.log(`[API Route: /api/offer-drive] Successfully fetched user profile for UID: ${verifiedUserId}. Can Drive: ${userProfile.canDrive}`);

      if (!userProfile.canDrive) {
        console.warn(`[API Route: /api/offer-drive] User ${verifiedUserId} (${userProfile.fullName}) is not permitted to drive (server-verified).`);
        return NextResponse.json({ success: false, message: "Your profile indicates you are not registered or permitted to drive. Please update your profile." }, { status: 403 });
      }
      console.log(`[API Route: /api/offer-drive] User ${verifiedUserId} (${userProfile.fullName}) is confirmed as a driver (server-verified).`);
    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] Error fetching user profile for UID ${verifiedUserId}:`, error);
      return NextResponse.json({ success: false, message: `Error verifying driver status: ${error.message}`, errorDetails: error.code }, { status: 500 });
    }

    let eventDetails: EventData;
    let eventNameForMessage: string;
    let eventDateForTimestamps: Date;
    try {
      const eventDocRef = db.collection('events').doc(validatedData.eventId);
      const eventDocSnap = await eventDocRef.get();
      if (!eventDocSnap.exists) {
        console.error(`[API Route: /api/offer-drive] Event not found in Firestore for eventId: ${validatedData.eventId}`);
        return NextResponse.json({ success: false, message: `Event with ID "${validatedData.eventId}" not found.` }, { status: 404 });
      }
      eventDetails = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;
      eventNameForMessage = eventDetails.name;
      const eventTimestamp = eventDetails.eventStartTimestamp || eventDetails.createdAt;
      eventDateForTimestamps = eventTimestamp.toDate();
      console.log(`[API Route: /api/offer-drive] Successfully fetched event details: "${eventNameForMessage}" (ID: ${validatedData.eventId})`);
    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] Error fetching event details for eventId ${validatedData.eventId}:`, error);
      return NextResponse.json({ success: false, message: `Error fetching event details: ${error.message}`, errorDetails: error.code }, { status: 500 });
    }

    const activeRydzCollectionRef = db.collection("activeRydz");
    const finalStartLocation = validatedData.direction === 'from_event' ? eventDetails.location : validatedData.driverStartLocation;
    const finalDestination = validatedData.direction === 'to_event' ? eventDetails.location : validatedData.driverEndLocation;


    if (body.fulfillingRequestId && body.passengersToFulfill && Array.isArray(body.passengersToFulfill) && body.passengersToFulfill.length > 0) {
      console.log(`[API Route: /api/offer-drive] Attempting to fulfill request ID: ${body.fulfillingRequestId} for ${body.passengersToFulfill.length} passengers.`);

      const passengersToFulfillCount = body.passengersToFulfill.length;
      if (passengersToFulfillCount > validatedData.seatsAvailable) {
        return NextResponse.json({ success: false, message: `Not enough seats defined in this offer (${validatedData.seatsAvailable}) to fulfill the request for ${passengersToFulfillCount} passengers.` }, { status: 400 });
      }

      const originalRequestDocRef = db.collection('rydz').doc(body.fulfillingRequestId);
      const originalRequestSnap = await originalRequestDocRef.get();
      if (!originalRequestSnap.exists) {
        return NextResponse.json({ success: false, message: `Original ryd request with ID ${body.fulfillingRequestId} not found.` }, { status: 404 });
      }
      const originalRequestData = originalRequestSnap.data() as RydData;

      const passengerManifestItems: PassengerManifestItem[] = [];
      for (const passengerId of body.passengersToFulfill) {
        passengerManifestItems.push({
          userId: passengerId,
          originalRydRequestId: body.fulfillingRequestId,
          pickupAddress: finalStartLocation,
          destinationAddress: finalDestination,
          status: PassengerManifestStatus.CONFIRMED_BY_DRIVER,
          requestedAt: originalRequestData.createdAt || Timestamp.now(),
        });
      }

      // Create a new ActiveRyd for fulfillment
      const [departureHours, departureMinutes] = validatedData.proposedDepartureTime.split(':').map(Number);
      const proposedDepartureDateTime = new Date(eventDateForTimestamps);
      proposedDepartureDateTime.setHours(departureHours, departureMinutes, 0, 0);
      const proposedDepartureFirestoreTimestamp = Timestamp.fromDate(proposedDepartureDateTime);

      const [arrivalHours, arrivalMinutes] = validatedData.plannedArrivalTime.split(':').map(Number);
      const plannedArrivalDateTime = new Date(eventDateForTimestamps);
      plannedArrivalDateTime.setHours(arrivalHours, arrivalMinutes, 0, 0);
      const plannedArrivalFirestoreTimestamp = Timestamp.fromDate(plannedArrivalDateTime);

      const vehicleParts = validatedData.vehicleMakeModel.split(' ');
      const make = vehicleParts[0] || "";
      const model = vehicleParts.slice(1).join(' ') || "";

      const newActiveRydObject: Omit<ActiveRyd, 'id' | 'updatedAt'> = {
        driverId: verifiedUserId,
        status: ActiveRydStatus.PLANNING,
        direction: validatedData.direction,
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        passengerManifest: passengerManifestItems,
        passengerUids: body.passengersToFulfill,
        associatedEventId: validatedData.eventId,
        eventName: eventDetails.name,
        notes: validatedData.notes || "",
        vehicleDetails: {
          passengerCapacity: String(validatedData.seatsAvailable),
          make: make,
          model: model,
          color: validatedData.vehicleColor || "",
          licensePlate: validatedData.licensePlate || "",
        },
        proposedDepartureTime: proposedDepartureFirestoreTimestamp,
        plannedArrivalTime: plannedArrivalFirestoreTimestamp,
        startLocationAddress: finalStartLocation,
        finalDestinationAddress: finalDestination,
      };

      const docRef = await activeRydzCollectionRef.add(newActiveRydObject);
      await originalRequestDocRef.update({
        status: 'driver_assigned' as RydStatus,
        driverId: verifiedUserId,
        assignedActiveRydId: docRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      const successMsg = `Successfully fulfilled ryd request for ${passengersToFulfillCount} passenger(s) to "${eventNameForMessage}" with a new ryd offer. Your Ryd ID is ${docRef.id}.`;
      console.log(`[API Route: /api/offer-drive] ${successMsg}`);
      return NextResponse.json({ success: true, message: successMsg, activeRydId: docRef.id }, { status: 201 });
      
    } else {
      // This is a general offer
      console.log(`[API Route: /api/offer-drive] Processing general ryd offer by driver ${verifiedUserId} for event ${validatedData.eventId}.`);
      
      const [departureHours, departureMinutes] = validatedData.proposedDepartureTime.split(':').map(Number);
      const proposedDepartureDateTime = new Date(eventDateForTimestamps);
      proposedDepartureDateTime.setHours(departureHours, departureMinutes, 0, 0);
      const proposedDepartureFirestoreTimestamp = Timestamp.fromDate(proposedDepartureDateTime);

      const [arrivalHours, arrivalMinutes] = validatedData.plannedArrivalTime.split(':').map(Number);
      const plannedArrivalDateTime = new Date(eventDateForTimestamps);
      plannedArrivalDateTime.setHours(arrivalHours, arrivalMinutes, 0, 0);
      const plannedArrivalFirestoreTimestamp = Timestamp.fromDate(plannedArrivalDateTime);

      const vehicleParts = validatedData.vehicleMakeModel.split(' ');
      const make = vehicleParts[0] || "";
      const model = vehicleParts.slice(1).join(' ') || "";

      const newActiveRydObject: Omit<ActiveRyd, 'id' | 'updatedAt'> = {
        driverId: verifiedUserId,
        status: ActiveRydStatus.AWAITING_PASSENGERS,
        direction: validatedData.direction,
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        passengerManifest: [],
        passengerUids: [],
        associatedEventId: validatedData.eventId,
        eventName: eventDetails.name,
        notes: validatedData.notes || "",
        vehicleDetails: {
          passengerCapacity: String(validatedData.seatsAvailable),
          make: make,
          model: model,
          color: validatedData.vehicleColor || "",
          licensePlate: validatedData.licensePlate || "",
        },
        proposedDepartureTime: proposedDepartureFirestoreTimestamp,
        plannedArrivalTime: plannedArrivalFirestoreTimestamp,
        startLocationAddress: finalStartLocation,
        finalDestinationAddress: finalDestination,
      };
      const docRef = await activeRydzCollectionRef.add(newActiveRydObject);
      const successMessage = `Successfully offered to drive for "${eventNameForMessage}"! Your Ryd offer ID is ${docRef.id}.`;
      console.log(`[API Route: /api/offer-drive] ${successMessage}`);
      return NextResponse.json({ success: true, message: successMessage, activeRydId: docRef.id }, { status: 201 });
    }

  } catch (error: any) {
    console.error('[API Route: /api/offer-drive] Outer error processing request:', error);
    let errorMessage = 'Error processing API request.';
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        errorMessage = "Invalid JSON in request body.";
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ success: false, message: errorMessage, errorDetails: error.toString() }, { status: 500 });
  }
}
