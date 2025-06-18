// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// Check if the app is already initialized to prevent re-initialization
if (!admin.apps.length) {
  try {
    // Attempt to initialize with application default credentials
    // This works in Cloud Run, Cloud Functions, App Engine, etc.
    // For local development, you'd need to set GOOGLE_APPLICATION_CREDENTIALS
    // to point to your service account key file.
    // Or, explicitly pass serviceAccount key content if using an env var for it.
    admin.initializeApp();
    console.log('[Firebase Admin] Initialized with default credentials.');
  } catch (error: any) {
    console.error('[Firebase Admin] Error initializing with default credentials:', error);
    // Fallback or more specific error handling if needed
    // For example, if you store service account JSON in an environment variable:
    /*
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // Optional: if using Realtime Database
        });
        console.log('[Firebase Admin] Initialized with service account from ENV var.');
      } catch (parseError) {
        console.error('[Firebase Admin] Failed to parse service account from ENV var:', parseError);
      }
    } else {
      console.error('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_JSON env var not set, and default init failed.');
    }
    */
  }
}

export default admin;
