import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { clearIndexedDbPersistence, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function envValue(key) {
  // Support both Vite (VITE_) and legacy REACT_APP_ env names.
  return import.meta.env[`VITE_${key}`] || import.meta.env[`REACT_APP_${key}`] || "";
}

export function createFirebaseClients(appName = "default") {
  const firebaseConfig = {
    apiKey: envValue("FIREBASE_API_KEY"),
    authDomain: envValue("FIREBASE_AUTH_DOMAIN"),
    projectId: envValue("FIREBASE_PROJECT_ID"),
    storageBucket: envValue("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: envValue("FIREBASE_MESSAGING_SENDER_ID"),
    appId: envValue("FIREBASE_APP_ID"),
  };

  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
  ];
  const missing = requiredKeys.filter((key) => !firebaseConfig[key]);
  if (missing.length) {
    throw new Error(
      `Missing Firebase env values (${missing.join(", ")}). Set VITE_FIREBASE_* or REACT_APP_FIREBASE_* in root .env.`
    );
  }

  const secondaryConfig = {
    ...firebaseConfig,
    apiKey: envValue("FIREBASE_SECONDARY_API_KEY") || firebaseConfig.apiKey,
  };

  const app = getApps().find((item) => item.name === appName) || initializeApp(firebaseConfig, appName);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    experimentalForceLongPolling: true,
  });

  clearIndexedDbPersistence(db).catch(() => {
    // Persistence can already be enabled by another tab/app; this is safe to ignore.
  });

  const secondaryName = `${appName}-Secondary`;
  const secondaryApp =
    getApps().find((item) => item.name === secondaryName) || initializeApp(secondaryConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  return { app, auth, db, storage, secondaryAuth };
}
