
// src/app/api/offer-drive/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { offerDriveFormStep1Schema } from '@/schemas/activeRydSchemas';
import admin from '@/lib/firebaseAdmin'; // Import the initialized admin SDK
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import Timestamp and FieldValue
import type { UserProfileData, EventData, ActiveRyd, ActiveRydStatus } from '@/types';

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

    // Client provided data (clientProvidedFullName and clientProvidedEventName are mainly for messages now)
    // eventId, seatsAvailable, notes are the core form data
    const {
      eventId,
      seatsAvailable,
      notes,
      clientProvidedFullName, // Used for user-friendly messages
    } = body;

    const coreFormData = { eventId, seatsAvailable, notes };
    const validationResult = offerDriveFormStep1Schema.safeParse(coreFormData);

    if (!validationResult.success) {
      console.error('[API Route: /api/offer-drive] Core form data validation failed:', validationResult.error.flatten());
      return NextResponse.json({ success: false, message: "Invalid form data submitted to API.", issues: validationResult.error.issues }, { status: 400 });
    }
    const validatedData = validationResult.data;
    console.log('[API Route: /api/offer-drive] Form data successfully validated by Zod.');

    const db = admin.firestore();

    // Step 5.3: Re-fetch driver's 'canDrive' status using Admin SDK and verifiedUserId
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

    // Step 5.4: Re-fetch event details using Admin SDK
    let eventDetails: EventData;
    let eventNameForMessage: string;
    try {
      const eventDocRef = db.collection('events').doc(validatedData.eventId);
      const eventDocSnap = await eventDocRef.get();
      if (!eventDocSnap.exists) {
        console.error(`[API Route: /api/offer-drive] Event not found in Firestore for eventId: ${validatedData.eventId}`);
        return NextResponse.json({ success: false, message: `Event with ID "${validatedData.eventId}" not found.` }, { status: 404 });
      }
      eventDetails = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;
      eventNameForMessage = eventDetails.name;
      console.log(`[API Route: /api/offer-drive] Successfully fetched event details: "${eventNameForMessage}" (ID: ${validatedData.eventId})`);
    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] Error fetching event details for eventId ${validatedData.eventId}:`, error);
      return NextResponse.json({ success: false, message: `Error fetching event details: ${error.message}`, errorDetails: error.code }, { status: 500 });
    }

    // Step 5.5: Create activeRydz document using Admin SDK
    console.log(`[API Route: /api/offer-drive] Attempting to create activeRydz document for eventId: ${validatedData.eventId}, driverId: ${verifiedUserId}`);
    
    const activeRydObject: Omit<ActiveRyd, 'id' | 'updatedAt'> = {
      driverId: verifiedUserId,
      status: 'planning' as ActiveRydStatus.PLANNING,
      createdAt: FieldValue.serverTimestamp() as Timestamp, // Use FieldValue for server timestamp
      passengerManifest: [],
      associatedEventId: validatedData.eventId,
      notes: validatedData.notes || "",
      vehicleDetails: {
          passengerCapacity: String(validatedData.seatsAvailable) || "0",
          // Add other vehicle details if available from userProfile.driverDetails
          make: userProfile.driverDetails?.primaryVehicle?.split(' ')[0] || "", // Example: "Toyota Camry 2020" -> "Toyota"
          model: userProfile.driverDetails?.primaryVehicle?.split(' ').slice(1).join(' ') || "", // Example: "Camry 2020"
      },
      finalDestinationAddress: eventDetails.location, // From fetched event details
      startLocationAddress: userProfile.address?.street ? `${userProfile.address.street}, ${userProfile.address.city}` : "Driver's location TBD", // Example, adjust as needed
    };

    try {
      const activeRydzCollectionRef = db.collection("activeRydz");
      const docRef = await activeRydzCollectionRef.add(activeRydObject);
      console.log(`[API Route: /api/offer-drive] Successfully created activeRydz document with ID: ${docRef.id}`);
      
      const successMessage = `Successfully offered to drive for "${eventNameForMessage}"! Your Ryd offer ID is ${docRef.id}.`;
      console.log(`[API Route: /api/offer-drive] ${successMessage}`);

      return NextResponse.json({
        success: true,
        message: successMessage,
        activeRydId: docRef.id,
      }, { status: 201 }); // 201 Created status

    } catch (error: any) {
      console.error(`[API Route: /api/offer-drive] CRITICAL ERROR creating activeRydz document for eventId ${validatedData.eventId}, driverId ${verifiedUserId}:`, error);
      let errorMessage = "Failed to create the ryd offer in Firestore (Admin SDK).";
       // No need to check e.code for 'permission-denied' here as Admin SDK bypasses rules
      errorMessage = `An unexpected error occurred while creating the ryd offer with Admin SDK: ${error.message || 'Unknown Firestore error'}. (Code: ${error.code || 'N/A'})`;
      console.error("[API Route: /api/offer-drive] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      return NextResponse.json({
        success: false,
        message: "An error occurred while creating your ryd offer using Admin SDK.",
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
