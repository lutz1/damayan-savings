import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ✅ Firebase Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// ✅ Initialize only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Auth and Storage first (important: avoid circular init)
const auth = getAuth(app);
const storage = getStorage(app);

// ✅ Firestore with persistence cleared
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

clearIndexedDbPersistence(db).catch(() => {
  console.warn("⚠️ Firestore persistence already active, skip clearing.");
});

// ✅ Secondary app (for admin account creation)
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

// ✅ Exports (order matters — do NOT reorder these)
export { app, auth, db, storage, secondaryAuth };