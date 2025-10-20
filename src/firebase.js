// ✅ firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// 🔹 Main Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// 🔹 Secondary Config — use NEW key if available
const secondaryConfig = {
  ...firebaseConfig,
  apiKey: process.env.REACT_APP_FIREBASE_SECONDARY_API_KEY || firebaseConfig.apiKey,
};

// Main app init
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

clearIndexedDbPersistence(db).catch(() =>
  console.warn("⚠️ Firestore persistence already active, skip clearing.")
);

// Secondary app init (isolated session)
const secondaryApp =
  getApps().find(a => a.name === "Secondary") || initializeApp(secondaryConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export { app, auth, db, storage, secondaryAuth };