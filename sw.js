// Офлайн-кэш: отдаём из кэша, в фоне обновляем. Меняй VERSION при выкладке новой версии.
importScripts('data.js'); // EX_IMAGES — список фото для офлайна
const VERSION = 'gym-v2';
const ASSETS = ['./', './index.html', './app.js', './data.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  ...[...EX_IMAGES].flatMap((id) => [`./img/ex/${id}-0.jpg`, `./img/ex/${id}-1.jpg`])];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || net;
    })
  );
});
