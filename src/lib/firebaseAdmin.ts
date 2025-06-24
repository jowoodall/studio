// src/lib/firebaseAdmin.ts
import admin from 'firebase-admin';

// This pattern prevents re-initializing the app on every hot-reload in development.
if (!admin.apps.length) {
  try {
    // In a Google Cloud environment (like App Hosting), the SDK automatically
    // discovers the project ID and credentials from the environment.
    admin.initializeApp();
    console.log('[Firebase Admin] Initialized successfully using Application Default Credentials.');
  } catch (error) {
    console.error('[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK:', error);
    // In a local development environment, this can happen if you haven't configured
    // Application Default Credentials. You may need to run 'gcloud auth application-default login'
    // in your terminal to authenticate your local environment.
  }
}

export default admin;
