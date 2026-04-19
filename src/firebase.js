// ✅ firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const envValue = (key) => import.meta.env[`VITE_${key}`] || import.meta.env[`REACT_APP_${key}`] || "";

// 🔹 Main Config
const firebaseConfig = {
  apiKey: envValue("FIREBASE_API_KEY"),
  authDomain: envValue("FIREBASE_AUTH_DOMAIN"),
  projectId: envValue("FIREBASE_PROJECT_ID"),
  storageBucket: envValue("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: envValue("FIREBASE_MESSAGING_SENDER_ID"),
  appId: envValue("FIREBASE_APP_ID"),
};

// 🔹 Secondary Config — use NEW key if available
const secondaryConfig = {
  ...firebaseConfig,
  apiKey: envValue("FIREBASE_SECONDARY_API_KEY") || firebaseConfig.apiKey,
};

// Main app init
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);

// Initialize Firestore
const db = initializeFirestore(app, { 
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true, // Avoid WebSocket issues
  cacheSizeBytes: 1048576, // Minimum allowed: 1 MB
});

// Secondary app init (isolated session)
const secondaryApp =
  getApps().find(a => a.name === "Secondary") || initializeApp(secondaryConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

// Initialize Cloud Functions
const functions = getFunctions(app);

export { app, auth, db, storage, secondaryAuth, functions };