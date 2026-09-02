const CACHE_NAME = 'scpb-ladder-v1.1.20260902064050'; // Incremented to force update
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://raw.githubusercontent.com/tboult/RR/refs/heads/main/SunLadder.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Completely bypass Service Worker for Google API calls
  if (event.request.url.includes('script.google.com')) {
    return; // Omit event.respondWith entirely
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
