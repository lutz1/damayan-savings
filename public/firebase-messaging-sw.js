/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js");

const swUrl = new URL(self.location.href);
const firebaseConfig = {
  apiKey: swUrl.searchParams.get("apiKey") || "",
  authDomain: swUrl.searchParams.get("authDomain") || "",
  projectId: swUrl.searchParams.get("projectId") || "",
  storageBucket: swUrl.searchParams.get("storageBucket") || "",
  messagingSenderId: swUrl.searchParams.get("messagingSenderId") || "",
  appId: swUrl.searchParams.get("appId") || "",
};
const appBase = swUrl.searchParams.get("appBase") || "/";

if (!firebase.apps.length && firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Damayan Notification";
  const body = payload?.notification?.body || payload?.data?.body || "You have a new update.";
  const icon = payload?.notification?.icon || `${appBase}logo192.png`;

  self.registration.showNotification(title, {
    body,
    icon,
    badge: `${appBase}logo192.png`,
    data: payload?.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clickPath = event.notification?.data?.path || appBase;
  event.waitUntil(clients.openWindow(clickPath));
});
