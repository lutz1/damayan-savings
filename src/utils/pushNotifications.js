import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { arrayUnion, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, auth, db } from "../firebase";

const envValue = (key) => import.meta.env[`VITE_${key}`] || import.meta.env[`REACT_APP_${key}`] || "";

const firebaseConfigForSw = {
  apiKey: envValue("FIREBASE_API_KEY"),
  authDomain: envValue("FIREBASE_AUTH_DOMAIN"),
  projectId: envValue("FIREBASE_PROJECT_ID"),
  storageBucket: envValue("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: envValue("FIREBASE_MESSAGING_SENDER_ID"),
  appId: envValue("FIREBASE_APP_ID"),
};

const VAPID_KEY = envValue("FIREBASE_VAPID_KEY");
const BASE_URL = import.meta.env.BASE_URL || "/";

const requiredMessagingConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const hasCompleteMessagingConfig = () => {
  const missing = requiredMessagingConfigKeys.filter((key) => !firebaseConfigForSw[key]);
  if (missing.length > 0) {
    console.warn(
      `[pushNotifications] Missing Firebase config values for FCM: ${missing.join(", ")}. Skipping push setup.`
    );
    return false;
  }
  return true;
};

let cachedSwRegistration = null;

const isPushServiceAbort = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "AbortError" || message.includes("push service error");
};

const canUseMessaging = () => {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!window.isSecureContext) return false;
  return true;
};

const getSwRegistration = async () => {
  if (cachedSwRegistration) return cachedSwRegistration;

  const query = new URLSearchParams({
    ...firebaseConfigForSw,
    appBase: BASE_URL,
  }).toString();
  const swUrl = `${BASE_URL}firebase-messaging-sw.js?${query}`;
  cachedSwRegistration = await navigator.serviceWorker.register(swUrl);
  return cachedSwRegistration;
};

const clearMessagingServiceWorkers = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((reg) => String(reg.active?.scriptURL || reg.installing?.scriptURL || "").includes("firebase-messaging-sw.js"))
      .map((reg) => reg.unregister())
  );
  cachedSwRegistration = null;
};

const getTokenWithRecovery = async () => {
  const messaging = getMessaging(app);
  const registration = await getSwRegistration();

  try {
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    const isAbort = isPushServiceAbort(error);
    if (!isAbort) throw error;

    // Recovery path for stale subscriptions/SW state in browser profile.
    await deleteToken(messaging).catch(() => {});
    await clearMessagingServiceWorkers().catch(() => {});

    const retryRegistration = await getSwRegistration();
    return getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: retryRegistration,
    });
  }
};

export const setupFcmForCurrentUser = async () => {
  try {
    if (!canUseMessaging()) return null;
    if (!hasCompleteMessagingConfig()) return null;

    const supported = await isSupported();
    if (!supported) return null;

    if (!VAPID_KEY) {
      console.warn("[pushNotifications] Missing FIREBASE_VAPID_KEY env; skipping FCM token setup.");
      return null;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return null;

    if (Notification.permission === "denied") return null;
    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return null;

    const token = await getTokenWithRecovery();

    if (!token) return null;

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        lastPushTokenUpdate: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (error) {
    if (isPushServiceAbort(error)) {
      return null;
    }
    console.warn("[pushNotifications] setup failed:", error);
    return null;
  }
};

export const onForegroundFcmMessage = async (handler) => {
  try {
    if (!canUseMessaging()) return () => {};
    if (!hasCompleteMessagingConfig()) return () => {};
    const supported = await isSupported();
    if (!supported) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      handler?.(payload);
    });
  } catch {
    return () => {};
  }
};
