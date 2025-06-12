
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

let app: FirebaseApp | undefined = undefined; // Initialize app as undefined
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  const missingVars = [];
  if (!firebaseConfig.apiKey) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.authDomain) missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!firebaseConfig.projectId) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

  if (missingVars.length > 0) {
    const errorMsg = `Critical Firebase configuration is missing. Please set the following environment variables in your .env.local file: ${missingVars.join(", ")}. Firebase initialization failed.`;
    console.error("Firebase Error:", errorMsg);
    // Throwing an error here will stop the app load and make the issue clear.
    // For a production build, you might handle this differently, but for development, this is explicit.
    throw new Error(errorMsg);
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Ensure app is initialized before trying to use it
if (app) {
  auth = getAuth(app);
  db = getFirestore(app); // Initialize Firestore
} else {
  // This block should ideally not be reached if the throw above works,
  // but as a fallback:
  const criticalErrorMsg = "Firebase app was not initialized. This is a critical error. Auth and Firestore services will not be available.";
  console.error(criticalErrorMsg);
  // Throw an error to prevent the app from continuing in a broken state
  throw new Error(criticalErrorMsg);
  // The dummy assignments below are less ideal than throwing.
  // auth = {} as Auth; 
  // db = {} as Firestore;
}

export { app, auth, db };
