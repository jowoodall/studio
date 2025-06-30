
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

    const activeRydzCollectionRef = db.collection("activeRydz");

    // If fulfilling a specific request
    if (body.fulfillingRequestId && body.passengersToFulfill && Array.isArray(body.passengersToFulfill) && body.passengersToFulfill.length > 0) {
      console.log(`[API Route: /api/offer-drive] Attempting to fulfill request ID: ${body.fulfillingRequestId} for ${body.passengersToFulfill.length} passengers.`);

      const passengersToFulfillCount = body.passengersToFulfill.length;
      if (passengersToFulfillCount > validatedData.seatsAvailable) {
        console.error(`[API Route: /api/offer-drive] Capacity error for new offer context: ${passengersToFulfillCount} passengers requested, but only ${validatedData.seatsAvailable} seats in this offer.`);
        return NextResponse.json({ success: false, message: `Not enough seats defined in this offer (${validatedData.seatsAvailable}) to fulfill the request for ${passengersToFulfillCount} passengers.` }, { status: 400 });
      }

      const originalRequestDocRef = db.collection('rydz').doc(body.fulfillingRequestId);
      const originalRequestSnap = await originalRequestDocRef.get();
      if (!originalRequestSnap.exists) {
        console.error(`[API Route: /api/offer-drive] Original ryd request with ID ${body.fulfillingRequestId} not found.`);
        return NextResponse.json({ success: false, message: `Original ryd request with ID ${body.fulfillingRequestId} not found.` }, { status: 404 });
      }
      const originalRequestData = originalRequestSnap.data() as RydData;

      // Check for existing suitable ActiveRyd by this driver for this event
      const existingRydQuery = activeRydzCollectionRef
        .where("driverId", "==", verifiedUserId)
        .where("associatedEventId", "==", validatedData.eventId)
        .where("status", "in", [ActiveRydStatus.PLANNING, ActiveRydStatus.AWAITING_PASSENGERS]); // Joinable statuses

      const existingRydSnapshot = await existingRydQuery.get();
      let suitableExistingActiveRyd: ActiveRyd | null = null;
      let existingActiveRydId: string | null = null;

      if (!existingRydSnapshot.empty) {
        // Prioritize the first suitable one found (could be enhanced to pick best fit)
        for (const doc of existingRydSnapshot.docs) {
            const ryd = doc.data() as ActiveRyd;
            const capacity = parseInt(ryd.vehicleDetails?.passengerCapacity || "0", 10);
            const currentPassengers = ryd.passengerManifest.filter(p => 
                p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && 
                p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
                p.status !== PassengerManifestStatus.MISSED_PICKUP
            ).length;
            if (capacity - currentPassengers >= passengersToFulfillCount) {
                suitableExistingActiveRyd = ryd;
                existingActiveRydId = doc.id;
                console.log(`[API Route: /api/offer-drive] Found suitable existing ActiveRyd ${existingActiveRydId} with capacity for fulfillment.`);
                break;
            }
        }
      }

      // Prepare passenger manifest items
      const passengerManifestItems: PassengerManifestItem[] = [];
      for (const passengerId of body.passengersToFulfill) {
        const passengerProfileSnap = await db.collection('users').doc(passengerId).get();
        let passengerPickupAddress = "Pickup to be coordinated";
        if (passengerProfileSnap.exists) { // CORRECTED LINE
          const pProfile = passengerProfileSnap.data() as UserProfileData;
          const pStreet = pProfile.address?.street || "";
          const pCity = pProfile.address?.city || "";
          const pState = pProfile.address?.state || "";
          const pZip = pProfile.address?.zip || "";
          const fullAddr = [pStreet, pCity, pState, pZip].filter(Boolean).join(", ");
          if (fullAddr.trim() !== "") passengerPickupAddress = fullAddr;
        } else if (originalRequestData.pickupLocation) {
          passengerPickupAddress = originalRequestData.pickupLocation;
        }
        passengerManifestItems.push({
          userId: passengerId,
          originalRydRequestId: body.fulfillingRequestId,
          pickupAddress: passengerPickupAddress,
          destinationAddress: eventDetails.location,
          status: PassengerManifestStatus.CONFIRMED_BY_DRIVER,
          requestedAt: originalRequestData.createdAt || Timestamp.now(),
        });
      }

      if (suitableExistingActiveRyd && existingActiveRydId) {
        // Add passengers to existing ActiveRyd
        console.log(`[API Route: /api/offer-drive] Adding ${passengerManifestItems.length} passengers to existing ActiveRyd ${existingActiveRydId}.`);
        const existingActiveRydRef = activeRydzCollectionRef.doc(existingActiveRydId);
        await existingActiveRydRef.update({
          passengerManifest: FieldValue.arrayUnion(...passengerManifestItems),
          updatedAt: FieldValue.serverTimestamp(),
          status: ActiveRydStatus.PLANNING, // Transition to PLANNING since passengers are added
        });
        
        await originalRequestDocRef.update({
          status: 'driver_assigned' as RydStatus,
          driverId: verifiedUserId,
          assignedActiveRydId: existingActiveRydId,
          updatedAt: FieldValue.serverTimestamp(),
        });

        const successMsg = `Successfully added ${passengersToFulfillCount} passenger(s) to your existing ryd for "${eventNameForMessage}". Ryd ID: ${existingActiveRydId}.`;
        console.log(`[API Route: /api/offer-drive] ${successMsg}`);
        return NextResponse.json({ success: true, message: successMsg, activeRydId: existingActiveRydId }, { status: 200 });

      } else {
        // Create a new ActiveRyd for fulfillment
        console.log(`[API Route: /api/offer-drive] No suitable existing ActiveRyd found, or existing ones are full. Creating a new ActiveRyd for fulfillment.`);
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
          status: ActiveRydStatus.PLANNING, // It has passengers, so start as PLANNING
          createdAt: FieldValue.serverTimestamp() as Timestamp,
          passengerManifest: passengerManifestItems,
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
          startLocationAddress: validatedData.driverStartLocation || (userProfile.address?.street ? `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, '') : "Driver's location TBD"),
          finalDestinationAddress: eventDetails.location,
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
      }
    } else {
      // This is a general offer, not fulfilling a specific request
      console.log(`[API Route: /api/offer-drive] Processing general ryd offer by driver ${verifiedUserId} for event ${validatedData.eventId}.`);
      const existingRydQuery = activeRydzCollectionRef
        .where("driverId", "==", verifiedUserId)
        .where("associatedEventId", "==", validatedData.eventId);

      const querySnapshot = await existingRydQuery.get();
      let hasActiveNonCancelledOffer = false;
      if (!querySnapshot.empty) {
        querySnapshot.forEach(doc => {
          const existingRyd = doc.data() as ActiveRyd;
          if (existingRyd.status !== ActiveRydStatus.CANCELLED_BY_DRIVER && existingRyd.status !== ActiveRydStatus.CANCELLED_BY_SYSTEM) {
            hasActiveNonCancelledOffer = true;
          }
        });
      }

      if (hasActiveNonCancelledOffer) {
        const message = `You already have an active ryd offer for the event: "${eventNameForMessage}". You can manage or cancel it from your rydz list.`;
        console.warn(`[API Route: /api/offer-drive] Driver ${verifiedUserId} already has an active non-cancelled offer for event ${validatedData.eventId}. Blocking new general offer.`);
        return NextResponse.json({ success: false, message: message }, { status: 409 });
      }
      console.log(`[API Route: /api/offer-drive] No existing active general ryd offers found for driver ${verifiedUserId} for event ${validatedData.eventId}. Proceeding with new general offer.`);
      
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
        status: ActiveRydStatus.AWAITING_PASSENGERS, // A new general offer is awaiting passengers
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        passengerManifest: [], // Empty for a general offer
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
        startLocationAddress: validatedData.driverStartLocation || (userProfile.address?.street ? `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, '') : "Driver's location TBD"),
        finalDestinationAddress: eventDetails.location,
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
    