// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// This pattern prevents re-initializing the app on every hot-reload in development.
if (!admin.apps.length) {
  try {
    // In a Google Cloud environment (like App Hosting), the SDK can automatically
    // discover credentials. Explicitly setting the Project ID ensures alignment
    // between the client and server Firebase contexts, preventing auth errors.
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rydzconnect',
    });
    console.log('[Firebase Admin] Initialized successfully.');
  } catch (error) {
    console.error('[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK:', error);
    // In a local development environment, this can happen if you haven't configured
    // Application Default Credentials. Run 'gcloud auth application-default login'
    // in your terminal to authenticate your local environment.
  }
}

export default admin;
