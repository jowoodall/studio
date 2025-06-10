
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// Import other Firebase services like Firestore as needed
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  // Check for missing essential Firebase config variables
  if (!firebaseConfig.apiKey) {
    console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing in .env.local. Firebase initialization failed.");
  }
  if (!firebaseConfig.authDomain) {
    console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing in .env.local. Firebase initialization failed.");
  }
  if (!firebaseConfig.projectId) {
    console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in .env.local. Firebase initialization failed.");
  }

  // Only initialize if essential configs are present
  if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
  } else {
    // Fallback or throw error if essential config is missing
    // For now, logging error and app will be undefined, leading to subsequent errors
    console.error("Firebase initialization was skipped due to missing critical environment variables.");
    // To make the app fail more gracefully or obviously, you could throw an error here:
    // throw new Error("Critical Firebase configuration is missing. Check .env.local and server logs.");
  }
} else {
  app = getApps()[0];
}

// Ensure app is initialized before trying to use it
if (app!) {
  auth = getAuth(app);
  db = getFirestore(app); // Initialize Firestore
} else {
  // Handle the case where app initialization failed
  // Assign dummy objects or throw to prevent further runtime errors if app is critical
  console.error("Firebase app was not initialized. Auth and Firestore services will not be available.");
  // Fallback to prevent crashing if auth/db are accessed later, though they won't work.
  // This part depends on how critical Firebase is at every point of your app.
  // A more robust solution might involve a global state indicating Firebase readiness.
  auth = {} as Auth; // Dummy assignment
  db = {} as Firestore; // Dummy assignment
}

export { app, auth, db };
