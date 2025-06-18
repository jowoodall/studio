// src/app/api/offer-drive/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { offerDriveFormStep1Schema } from '@/schemas/activeRydSchemas';
import admin from '@/lib/firebaseAdmin'; // Import the initialized admin SDK

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ success: false, message: `Authentication failed: ${error.message}`, errorDetails: error.code }, { status: 403 });
    }

    const verifiedUserId = decodedToken.uid; // This is the authenticated user

    const body = await request.json();
    console.log('[API Route: /api/offer-drive] Received request body:', JSON.stringify(body, null, 2));

    const {
      eventId,
      seatsAvailable,
      notes,
      // userId is now derived from the verified ID token, no longer from client body for security
      clientProvidedFullName, // Still useful for messages, but primary ID is verifiedUserId
      clientProvidedCanDrive, // Will be re-verified server-side using Admin SDK later
      clientProvidedEventName, // Still useful for messages
    } = body;

    const coreFormData = { eventId, seatsAvailable, notes };
    const validationResult = offerDriveFormStep1Schema.safeParse(coreFormData);

    if (!validationResult.success) {
      console.error('[API Route: /api/offer-drive] Core form data validation failed:', validationResult.error.flatten());
      return NextResponse.json({ success: false, message: "Invalid form data submitted to API.", issues: validationResult.error.issues }, { status: 400 });
    }

    // Placeholder for Step 5.3: Re-fetch driver's 'canDrive' status using Admin SDK and verifiedUserId
    // Placeholder for Step 5.4: Re-fetch event details using Admin SDK
    // Placeholder for Step 5.5: Create activeRydz document using Admin SDK

    const successMessage = `API Route (Step 5.2): Offer from ${clientProvidedFullName || 'User'} (Verified UID: ${verifiedUserId}) for event "${clientProvidedEventName || eventId}" received. Token VERIFIED. Next: Admin SDK Firestore Ops.`;
    console.log(`[API Route: /api/offer-drive] ${successMessage}`);

    return NextResponse.json({
      success: true,
      message: successMessage,
      verifiedUserId: verifiedUserId, // Send back the verified UID for confirmation
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API Route: /api/offer-drive] Error processing request:', error);
    let errorMessage = 'Error processing API request.';
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        errorMessage = "Invalid JSON in request body.";
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ success: false, message: errorMessage, errorDetails: error.toString() }, { status: 500 });
  }
}
