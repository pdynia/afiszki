// Offline cache for the app shell. Bump CACHE when files change.
const CACHE = 'cards-v0.8.3';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './db.js', './apkg.js', './scheduler.js', './fsrs.js', './render.js', './sync.js', './firebase-config.js', './i18n.js', './help.js',
  './manifest.webmanifest', './icon.svg',
  './vendor/jszip.min.js', './vendor/sql-wasm.js', './vendor/sql-wasm.wasm',
  './vendor/firebase-app-compat.js', './vendor/firebase-auth-compat.js', './vendor/firebase-firestore-compat.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network-first for the app's own files (so a deploy is picked up on the next
// load), falling back to the cache when offline. Vendor libraries are cache-first.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const cacheFirst = url.pathname.includes('/vendor/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request, { ignoreSearch: true });
    if (cacheFirst && cached) return cached;
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
