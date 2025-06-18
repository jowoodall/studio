
// src/app/api/offer-drive/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
// Re-using the schema for basic form data validation.
// Note: This schema doesn't include userId or client-provided details,
// those will be part of the broader request body for now.
import { offerDriveFormStep1Schema } from '@/schemas/activeRydSchemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[API Route: /api/offer-drive] Received request body:', JSON.stringify(body, null, 2));

    // Extract data that the client will send
    // This includes form data and additional details like userId
    const {
      eventId,
      seatsAvailable,
      notes,
      userId, // Client will send this; in a real API, we'd get this from a verified ID token
      clientProvidedFullName,
      clientProvidedCanDrive,
      clientProvidedEventName,
    } = body;

    // Validate the core form data part of the payload
    const coreFormData = { eventId, seatsAvailable, notes };
    const validationResult = offerDriveFormStep1Schema.safeParse(coreFormData);

    if (!validationResult.success) {
      console.error('[API Route: /api/offer-drive] Core form data validation failed:', validationResult.error.flatten());
      return NextResponse.json({ success: false, message: "Invalid form data submitted to API.", issues: validationResult.error.issues }, { status: 400 });
    }

    if (!userId) {
        console.error('[API Route: /api/offer-drive] userId missing from request body.');
        return NextResponse.json({ success: false, message: "User ID missing from request." }, { status: 400 });
    }

    // For this initial step, we are not interacting with Firebase Admin SDK or Firestore yet.
    // We are just confirming the API route is callable and receives data.
    // The actual logic to verify user (via ID token) and then perform Firestore operations
    // using Admin SDK will be added in subsequent steps.

    const successMessage = `API Route: Offer from ${clientProvidedFullName || 'User'} (${userId}) for event "${clientProvidedEventName || eventId}" received. (Form data schema validated). Next step: Admin SDK & Firestore.`;
    console.log(`[API Route: /api/offer-drive] ${successMessage}`);

    return NextResponse.json({
      success: true,
      message: successMessage,
      // activeRydId: 'dummy-api-ryd-id' // Placeholder if we want to mimic the action's return
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API Route: /api/offer-drive] Error processing request:', error);
    // Differentiate between JSON parsing errors and other errors
    let errorMessage = 'Error processing API request.';
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        errorMessage = "Invalid JSON in request body.";
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ success: false, message: errorMessage, errorDetails: error.toString() }, { status: 500 });
  }
}
