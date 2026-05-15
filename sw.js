// ─── CHRIST MEDIA SERVICE WORKER ───
// Incrémenter CACHE_VERSION à chaque déploiement force le remplacement du cache
const CACHE_VERSION = 'v11-20260515b';
const CACHE_NAME = 'christmedia-' + CACHE_VERSION;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
];

// ─── INSTALLATION : mise en cache des assets de base ───
self.addEventListener('install', event => {
  console.log('[SW] Install — cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Certains assets non mis en cache:', err);
      });
    })
  );
  // Ne PAS appeler skipWaiting ici — on attend le message de index.html
});

// ─── ACTIVATION : supprimer les anciens caches ───
self.addEventListener('activate', event => {
  console.log('[SW] Activate — cache:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim()) // Prendre le contrôle de tous les onglets ouverts
  );
});

// ─── MESSAGE : skipWaiting déclenché depuis index.html ───
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting demandé');
    self.skipWaiting();
  }
});

// ─── FETCH : stratégie Network First pour index.html, Cache First pour le reste ───
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et Firebase/Cloudinary
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('cloudinary')) return;
  if (url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) return;

  // Network First pour index.html — toujours essayer d'avoir la dernière version
  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)) // Fallback cache si hors ligne
    );
    return;
  }

  // Cache First pour les autres assets (icons, manifest…)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
