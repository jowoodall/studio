// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// This pattern prevents re-initializing the app on every hot-reload in development.
if (!admin.apps.length) {
  try {
    // In a Google Cloud environment (like App Hosting), the SDK can automatically
    // discover credentials, but we are explicitly setting the Project ID to
    // resolve an "audience" claim mismatch between the client and server.
    admin.initializeApp({
      // This MUST match the client-side `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
      // The error message indicates the client is using 'rydzconnect'.
      projectId: 'rydzconnect',
    });
    console.log('[Firebase Admin] Initialized successfully using specified project ID.');
  } catch (error) {
    console.error('[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK:', error);
    // In a local development environment, this can happen if you haven't configured
    // Application Default Credentials. You may need to run 'gcloud auth application-default login'
    // in your terminal to authenticate your local environment.
  }
}

export default admin;
