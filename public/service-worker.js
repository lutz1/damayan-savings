// Lightweight service worker to satisfy PWA install criteria.
// It forwards all fetch requests to network and does not cache (no offline behavior).

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // simple network-first pass-through
  event.respondWith(fetch(event.request));
});
