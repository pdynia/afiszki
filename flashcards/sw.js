// Offline cache for the app shell. Bump CACHE when files change.
const CACHE = 'cards-v0.4.0';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './db.js', './apkg.js', './scheduler.js', './render.js', './i18n.js', './help.js',
  './manifest.webmanifest', './icon.svg',
  './vendor/jszip.min.js', './vendor/sql-wasm.js', './vendor/sql-wasm.wasm',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
