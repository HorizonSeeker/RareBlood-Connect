// lib/firebaseClient.js
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// 1. Initialize Firebase App (safe for both Server and Client)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 2. Initialize Messaging (CLIENT ONLY)
// Use messaging = null by default so the server doesn't error
let messaging = null;

if (typeof window !== "undefined") {
  // Only call getMessaging when running in the browser (window is available)
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Failed to initialize Messaging on client:", error);
  }
}

// 3. Request token helper (with diagnostic logs)
export const requestForToken = async () => {
  // If messaging isn't available (server or not initialized) -> bail out
  if (!messaging) {
    console.log("Messaging not ready (or running on server).");
    return null;
  }

  try {
    console.log('🔥 Requesting token...');
    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY
    });

    if (currentToken) {
      console.log('✅ FCM Token:', currentToken);
      return currentToken;
    } else {
      console.log('❌ Failed to get Token.');
      return null;
    }
  } catch (err) {
    console.log('❌ Error fetching token:', err);
    return null;
  }
};

export { app, messaging };