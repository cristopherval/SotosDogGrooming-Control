// sw.js — minimal offline cache for the app shell
const CACHE = 'sotos-v20';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/config.js',
  './js/i18n.js',
  './js/utils.js',
  './js/dogs.js',
  './js/employees.js',
  './js/appointments.js',
  './js/vaccines.js',
  './js/settings.js',
  './vendor/heic2any.min.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Only handle our own app shell. Supabase (auth/REST/storage) and CDN requests
  // are cross-origin — let them go straight to the network (online-only data).
  if (new URL(req.url).origin !== self.location.origin) return;
  // Network-first: always load the latest code when online; fall back to the
  // cached shell only when offline. (App data is online-only anyway.)
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
