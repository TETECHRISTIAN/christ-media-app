// ─── SERVICE WORKER — Christ Media PWA ───
// Version auto — le cache se renouvelle automatiquement à chaque déploiement

const CACHE_NAME = 'christ-media-20250514';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

// Domaines à NE JAMAIS mettre en cache (toujours réseau)
const NETWORK_ONLY_DOMAINS = [
  'firebaseio.com',
  'firebase.googleapis.com',
  'googleapis.com',
  'gstatic.com',
  'firebaseapp.com',
  'anthropic.com',
  'api.cloudinary.com',
  'res.cloudinary.com',
];

// ─── INSTALL ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Certains assets non mis en cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ───
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (!url.startsWith('http')) return;

  const isNetworkOnly = NETWORK_ONLY_DOMAINS.some(domain => url.includes(domain));
  if (isNetworkOnly) return;

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
