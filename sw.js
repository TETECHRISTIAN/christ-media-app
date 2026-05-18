// ─── SERVICE WORKER — Christ Media PWA ───
// Version dynamique : le cache se renouvelle automatiquement à chaque déploiement
// Ne PAS modifier CACHE_VERSION manuellement — il est mis à jour par l'app

const APP_VERSION = '2.0';
// CACHE_VERSION est injecté dynamiquement via postMessage depuis l'app
// Valeur par défaut = date du jour (fallback si pas encore de version reçue)
let CACHE_NAME = 'christ-media-' + APP_VERSION + '-' + new Date().toISOString().slice(0,10);

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

// ─── MESSAGE : mise à jour de version depuis l'app ───
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SET_CACHE_VERSION'){
    const newCache = 'christ-media-' + APP_VERSION + '-' + event.data.version;
    if(newCache !== CACHE_NAME){
      const oldCache = CACHE_NAME;
      CACHE_NAME = newCache;
      // Supprimer l'ancien cache immédiatement
      caches.delete(oldCache).then(() => {
        // Pré-cacher les assets avec la nouvelle version
        caches.open(CACHE_NAME).then(cache => {
          cache.addAll(STATIC_ASSETS).catch(err => {
            console.warn('SW: Pré-cache nouvelle version échoué:', err);
          });
        });
      });
      // Notifier tous les clients qu'une nouvelle version est active
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_UPDATED', version: event.data.version });
        });
      });
    }
  }
});

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
          .map(key => {
            console.log('SW: Suppression ancien cache:', key);
            return caches.delete(key);
          })
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
      // Toujours essayer le réseau d'abord pour index.html (évite cache périmé)
      if(event.request.destination === 'document'){
        return fetch(event.request)
          .then(response => {
            if(!response || response.status !== 200) return cached || response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));
      }

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
