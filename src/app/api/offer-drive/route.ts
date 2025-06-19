
// src/app/api/offer-drive/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { offerDriveFormSchema } from '@/schemas/activeRydSchemas';
import admin from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData, EventData, ActiveRyd, RydData, RydStatus, PassengerManifestItem } from '@/types';
import { ActiveRydStatus, PassengerManifestStatus } from '@/types';

export async function POST(request: NextRequest) {
  console.log('[API Route: /api/offer-drive] POST request received.');
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      console.error('[API Route: /api/offer-drive] Missing or malformed Authorization header.');
      return NextResponse.json({ success: false, message: 'Unauthorized. No token provided.' }, { status: 401 });
    }

    const idToken = authorizationHeader.split('Bearer ')[1];
    if (!idToken) {
      console.error('[API Route: /api/offer-drive] ID token is empty after splitting Bearer.');
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
      eventDateForTimestamps = eventDetails.eventTimestamp.toDate();
      console.log(`[API Route: /api/offer-drive] Successfully fetched event details: "${eventNameForMessage}" (ID: ${validatedData.eventId})`);
    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] Error fetching event details for eventId ${validatedData.eventId}:`, error);
      return NextResponse.json({ success: false, message: `Error fetching event details: ${error.message}`, errorDetails: error.code }, { status: 500 });
    }
    
    // Check for existing active ryd offers by this driver for this event
    // This check is only relevant if NOT fulfilling a specific request, as a new ActiveRyd is made for each fulfillment.
    if (!body.fulfillingRequestId) {
        try {
        console.log(`[API Route: /api/offer-drive] Checking for existing ryd offers by driver ${verifiedUserId} for event ${validatedData.eventId}`);
        const activeRydzCollectionRef = db.collection("activeRydz");
        const existingRydQuery = activeRydzCollectionRef
            .where("driverId", "==", verifiedUserId)
            .where("associatedEventId", "==", validatedData.eventId);

        const querySnapshot = await existingRydQuery.get();
        let hasActiveOffer = false;
        if (!querySnapshot.empty) {
            querySnapshot.forEach(doc => {
            const existingRyd = doc.data() as ActiveRyd;
            if (existingRyd.status !== ActiveRydStatus.CANCELLED_BY_DRIVER && existingRyd.status !== ActiveRydStatus.CANCELLED_BY_SYSTEM) {
                hasActiveOffer = true;
            }
            });
        }

        if (hasActiveOffer) {
            const message = `You already have an active ryd offer for the event: "${eventNameForMessage}". You can manage or cancel it from your rydz list.`;
            console.warn(`[API Route: /api/offer-drive] Driver ${verifiedUserId} already has an active offer for event ${validatedData.eventId}. Blocking new general offer.`);
            return NextResponse.json({ success: false, message: message }, { status: 409 }); 
        }
        console.log(`[API Route: /api/offer-drive] No existing active general ryd offers found for driver ${verifiedUserId} for event ${validatedData.eventId}. Proceeding.`);

        } catch (error: any) {
            console.error(`[API Route: /api/offer-drive] Error checking for existing ryd offers:`, error);
            return NextResponse.json({ success: false, message: `Error verifying existing offers: ${error.message}` }, { status: 500 });
        }
    }


    console.log(`[API Route: /api/offer-drive] Attempting to create activeRydz document for eventId: ${validatedData.eventId}, driverId: ${verifiedUserId}`);

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

    let passengerManifestItems: PassengerManifestItem[] = [];
    let originalRequestDataForMessage: RydData | null = null;

    if (body.fulfillingRequestId && body.passengersToFulfill && Array.isArray(body.passengersToFulfill) && body.passengersToFulfill.length > 0) {
        console.log(`[API Route: /api/offer-drive] Fulfilling request ID: ${body.fulfillingRequestId} for ${body.passengersToFulfill.length} passengers.`);
        
        if (body.passengersToFulfill.length > validatedData.seatsAvailable) {
            console.error(`[API Route: /api/offer-drive] Capacity error: ${body.passengersToFulfill.length} passengers requested, but only ${validatedData.seatsAvailable} seats available.`);
            return NextResponse.json({ success: false, message: `Not enough seats available (${validatedData.seatsAvailable}) to fulfill the request for ${body.passengersToFulfill.length} passengers.` }, { status: 400 });
        }

        const originalRequestDocRef = db.collection('rydz').doc(body.fulfillingRequestId);
        const originalRequestSnap = await originalRequestDocRef.get();
        if (!originalRequestSnap.exists) {
            console.error(`[API Route: /api/offer-drive] Original ryd request with ID ${body.fulfillingRequestId} not found.`);
            return NextResponse.json({ success: false, message: `Original ryd request with ID ${body.fulfillingRequestId} not found.` }, { status: 404 });
        }
        originalRequestDataForMessage = originalRequestSnap.data() as RydData;

        for (const passengerId of body.passengersToFulfill) {
            const passengerProfileSnap = await db.collection('users').doc(passengerId).get();
            let passengerPickupAddress = "Pickup to be coordinated"; // Default
            if (passengerProfileSnap.exists()) {
                const passengerProfile = passengerProfileSnap.data() as UserProfileData;
                const pStreet = passengerProfile.address?.street || "";
                const pCity = passengerProfile.address?.city || "";
                const pState = passengerProfile.address?.state || "";
                const pZip = passengerProfile.address?.zip || "";
                const fullAddr = [pStreet, pCity, pState, pZip].filter(Boolean).join(", ");
                if (fullAddr.trim() !== "") passengerPickupAddress = fullAddr;
            } else if (originalRequestDataForMessage.pickupLocation) {
                passengerPickupAddress = originalRequestDataForMessage.pickupLocation;
            }

            passengerManifestItems.push({
                userId: passengerId,
                originalRydRequestId: body.fulfillingRequestId,
                pickupAddress: passengerPickupAddress,
                destinationAddress: eventDetails.location, 
                status: PassengerManifestStatus.CONFIRMED_BY_DRIVER,
                requestedAt: originalRequestDataForMessage.createdAt || Timestamp.now(),
            });
        }
        console.log(`[API Route: /api/offer-drive] Prepared ${passengerManifestItems.length} passenger manifest items for fulfillment.`);
    }


    const activeRydObject: Omit<ActiveRyd, 'id' | 'updatedAt'> = {
      driverId: verifiedUserId,
      status: passengerManifestItems.length > 0 ? ActiveRydStatus.AWAITING_PASSENGERS : ActiveRydStatus.PLANNING, // If fulfilling, start as AWAITING_PASSENGERS
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      passengerManifest: passengerManifestItems,
      associatedEventId: validatedData.eventId,
      notes: validatedData.notes || "",
      vehicleDetails: {
          passengerCapacity: String(validatedData.seatsAvailable) || "0",
          make: make,
          model: model,
          color: validatedData.vehicleColor || "",
          licensePlate: validatedData.licensePlate || "",
      },
      proposedDepartureTime: proposedDepartureFirestoreTimestamp,
      plannedArrivalTime: plannedArrivalFirestoreTimestamp,
      startLocationAddress: validatedData.driverStartLocation || (userProfile.address?.street ? `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, '') : "Driver's location TBD"),
      finalDestinationAddress: eventDetails.location,
    };

    try {
      const activeRydzCollectionRef = db.collection("activeRydz");
      const docRef = await activeRydzCollectionRef.add(activeRydObject);
      console.log(`[API Route: /api/offer-drive] Successfully created activeRydz document with ID: ${docRef.id}`);
      
      let successMessage = `Successfully offered to drive for "${eventNameForMessage}"! Your Ryd offer ID is ${docRef.id}.`;

      // If fulfilling a request, update the original RydData
      if (body.fulfillingRequestId && originalRequestDataForMessage) {
        const originalRequestDocRef = db.collection('rydz').doc(body.fulfillingRequestId);
        await originalRequestDocRef.update({
            status: 'driver_assigned' as RydStatus,
            driverId: verifiedUserId,
            assignedActiveRydId: docRef.id,
            updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[API Route: /api/offer-drive] Successfully updated original RydData ${body.fulfillingRequestId} to status 'driver_assigned' and linked ActiveRyd ${docRef.id}.`);
        const numPassengers = body.passengersToFulfill?.length || 0;
        const passengerText = numPassengers === 1 ? "1 passenger" : `${numPassengers} passengers`;
        successMessage = `Successfully fulfilled ryd request for ${passengerText} to "${eventNameForMessage}"! Your Ryd ID is ${docRef.id}.`;
      }
      
      console.log(`[API Route: /api/offer-drive] ${successMessage}`);
      return NextResponse.json({
        success: true,
        message: successMessage,
        activeRydId: docRef.id,
      }, { status: 201 });

    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] CRITICAL ERROR creating activeRydz document or updating original request for eventId ${validatedData.eventId}, driverId ${verifiedUserId}:`, error);
      let errorMessage = "Failed to process the ryd offer in Firestore (Admin SDK).";
      errorMessage = `An unexpected error occurred: ${error.message || 'Unknown Firestore error'}. (Code: ${error.code || 'N/A'})`;
      console.error("[API Route: /api/offer-drive] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      return NextResponse.json({
        success: false,
        message: "An error occurred while processing your ryd offer using Admin SDK.",
        errorDetails: errorMessage,
      }, { status: 500 });
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

    