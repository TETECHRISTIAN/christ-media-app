const CACHE_NAME = 'christ-media-v4';
const BASE = '/christ-media-app/';
const URLS_TO_CACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-144x144.png',
  BASE + 'icons/icon-192x192.png',
  BASE + 'icons/icon-512x512.png'
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE).catch(err => {
        console.warn('[SW] Certaines ressources non mises en cache:', err);
      });
    })
  );
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Messages depuis l'app (mise à jour de version)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_CACHE_VERSION') {
    const newVersion = event.data.version;
    const newCacheName = 'christ-media-' + newVersion;
    if (newCacheName !== CACHE_NAME) {
      caches.open(newCacheName).then(cache => {
        return cache.addAll(URLS_TO_CACHE).catch(() => {});
      }).then(() => {
        caches.keys().then(keys =>
          Promise.all(keys.filter(k => k !== newCacheName).map(k => caches.delete(k)))
        );
        if (event.source) {
          event.source.postMessage({ type: 'CACHE_UPDATED', version: newVersion });
        }
      });
    }
  }
});

// Fetch : réseau en priorité, cache en fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // FIX : ignorer tout schéma non-HTTP (chrome-extension://, data:, blob:, etc.)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Ne pas intercepter les requêtes Firebase / Google APIs
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;

  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === BASE;

  event.respondWith(
    fetch(isHTML ? new Request(event.request, { cache: 'no-store' }) : event.request)
      .then(response => {
        // Ne mettre en cache que les réponses HTTP(S) valides et non-opaques
        if (
          response &&
          response.status === 200 &&
          response.type !== 'opaque'
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
