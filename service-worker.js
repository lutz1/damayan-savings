// Progressive Web App Service Worker
// Implements network-first strategy with offline fallback

const CACHE_NAME = 'damayan-v1';
const ASSETS_TO_CACHE = [
  '/damayan-savings/',
  '/damayan-savings/index.html',
  '/damayan-savings/manifest.json',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some assets failed to cache during install:', err);
        // Continue even if some assets fail to cache
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and certain paths
  if (url.origin !== location.origin) {
    return;
  }

  // Network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((err) => {
              // Silently fail on cache errors (network errors, quota exceeded, etc)
              console.debug('Cache put failed for:', request.url, err);
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Network request failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If not in cache and offline, return a fallback
          if (request.mode === 'navigate') {
            return caches.match('/damayan-savings/index.html');
          }

          return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// Background sync for failed requests (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Add logic to retry failed requests
      Promise.resolve()
    );
  }
});

