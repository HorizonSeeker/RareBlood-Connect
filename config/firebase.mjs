import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Helper to convert literal "\\n" sequences into real newlines in private keys
const formatPrivateKey = (key) => {
  if (!key) return key;
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
};

let initialized = false;

// First try: initialize from environment variables (recommended for CI / container deployments)
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
  try {
    const serviceAccountFromEnv = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountFromEnv)
    });
    initialized = true;
    console.log('Firebase Admin initialized from environment variables');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin from env:', err && err.message);
  }
}

// Second try: fall back to serviceAccountKey.json at project root (local development)
if (!initialized) {
  try {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(raw);
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        initialized = true;
        console.log('Firebase Admin initialized from serviceAccountKey.json');
      } catch (err) {
        console.error('Failed to initialize Firebase Admin from file:', err && err.message);
      }
    } else {
      console.warn('Firebase serviceAccountKey.json not found at project root.');
    }
  } catch (err) {
    console.error('Error reading serviceAccountKey.json', err);
  }
}

// If we still haven't initialized, provide a safe noop messaging stub to avoid runtime crashes
if (!initialized) {
  console.warn('Firebase admin not initialized - messaging will be a noop');
  const noopMessaging = () => ({
    sendMulticast: async () => ({ successCount: 0, failureCount: 0, responses: [] })
  });
  // @ts-ignore
  admin.messaging = noopMessaging;
}

export default admin;
