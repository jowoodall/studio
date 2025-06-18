// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// Check if the app is already initialized to prevent re-initialization
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.error('[Firebase Admin] CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is not set. Cannot initialize Admin SDK with specific project ID.');
      // Optionally, you could still try default init, but it might lead to the 'aud' error again
      // admin.initializeApp();
      // console.warn('[Firebase Admin] Initialized with default credentials (project ID not explicitly set). This might lead to audience claim issues.');
    } else {
      admin.initializeApp({
        projectId: projectId,
        // Credential will be picked up from Application Default Credentials in App Hosting
      });
      console.log(`[Firebase Admin] Initialized for project ID: ${projectId}`);
    }
  } catch (error: any) {
    console.error('[Firebase Admin] Error initializing with default credentials or specified project ID:', error);
    // Fallback or more specific error handling if needed
    // For example, if you store service account JSON in an environment variable:
    /*
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Also ensure projectId here
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
