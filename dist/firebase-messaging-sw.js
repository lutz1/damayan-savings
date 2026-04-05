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
const appOrigin = swUrl.origin;
let appBadgeCount = 0;

const resolveAppUrl = (path = appBase) => {
  const safePath = String(path || "").trim();
  if (!safePath) return new URL(appBase, appOrigin).toString();
  if (safePath.startsWith("http://") || safePath.startsWith("https://")) return safePath;

  const normalizedBase = appBase.endsWith("/") ? appBase : `${appBase}/`;
  const relativePath = safePath.startsWith("/")
    ? safePath.replace(/^\/+/, "")
    : safePath.replace(/^\/+/, "");

  return new URL(`${normalizedBase}${relativePath}`.replace(/([^:]\/)\/+/g, "$1"), appOrigin).toString();
};

const updateAppBadge = async (count) => {
  appBadgeCount = Math.max(0, Number(count) || 0);

  try {
    if (self.registration && typeof self.registration.setAppBadge === "function") {
      if (appBadgeCount > 0) {
        await self.registration.setAppBadge(appBadgeCount);
      } else if (typeof self.registration.clearAppBadge === "function") {
        await self.registration.clearAppBadge();
      } else {
        await self.registration.setAppBadge(0);
      }
      return;
    }
  } catch {}

  try {
    if (self.navigator && typeof self.navigator.setAppBadge === "function") {
      if (appBadgeCount > 0) {
        await self.navigator.setAppBadge(appBadgeCount);
      } else if (typeof self.navigator.clearAppBadge === "function") {
        await self.navigator.clearAppBadge();
      } else {
        await self.navigator.setAppBadge(0);
      }
    }
  } catch {}
};

const showPushNotification = async (payload = {}) => {
  const title = payload?.notification?.title || payload?.data?.title || "Damayan Notification";
  const body = payload?.notification?.body || payload?.data?.body || "You have a new update.";
  const icon = payload?.notification?.icon || `${appBase}logo192.png`;
  const badge = payload?.notification?.badge || `${appBase}logo192.png`;
  const path = resolveAppUrl(payload?.data?.path || appBase);

  await updateAppBadge(appBadgeCount + 1);

  return self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag: payload?.data?.type ? `amayan-${payload.data.type}` : "amayan-notification",
    renotify: true,
    requireInteraction: false,
    data: {
      ...(payload?.data || {}),
      path,
    },
  });
};

if (!firebase.apps.length && firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  showPushNotification(payload).catch(() => {});
});

self.addEventListener("message", (event) => {
  const message = event.data || {};

  if (message.type === "SET_APP_BADGE") {
    event.waitUntil(updateAppBadge(message.count));
  }

  if (message.type === "CLEAR_APP_BADGE") {
    event.waitUntil(updateAppBadge(0));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveAppUrl(event.notification?.data?.path || appBase);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => {
        const clientUrl = String(client.url || "");
        return clientUrl === targetUrl || clientUrl.startsWith(targetUrl);
      });

      if (existingClient) {
        return existingClient.focus();
      }

      return clients.openWindow(targetUrl);
    }).finally(() => updateAppBadge(Math.max(0, appBadgeCount - 1)).catch(() => {}))
  );
});
