const CACHE_NAME = 'scpb-ladder-v20260927133146';
const ASSETS_TO_CACHE = [
  './',
  './manifest.json',
  'https://raw.githubusercontent.com/tboult/RR/refs/heads/main/SunLadder.png'
];

// 1. INSTALL: Resilient caching (one failing asset won't break the SW)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Use Promise.allSettled so a single failure doesn't abort installation
        await Promise.allSettled(
          ASSETS_TO_CACHE.map(async (url) => {
            try {
              await cache.add(url);
            } catch (err) {
              console.warn(`[SW] Failed to pre-cache asset: ${url}`, err);
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE: Delete old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// 3. FETCH: Safe request handling
self.addEventListener('fetch', (event) => {
  // Ignore non-GET methods (POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Ignore Google Apps Script & external endpoints
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      // Return cached asset if available, otherwise fetch from network
      return cachedResponse || fetch(event.request);
    })
  );
});
