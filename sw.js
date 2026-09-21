const CACHE_NAME = 'scpb-ladder-v20260920211954';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://raw.githubusercontent.com/tboult/RR/refs/heads/main/SunLadder.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting()) // Only skip waiting AFTER caching completes
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      ))
      .then(() => self.clients.claim()) // Claim clients AFTER cache cleanup
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
