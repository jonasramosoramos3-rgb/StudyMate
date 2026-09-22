// StudyMate V4 Service Worker - Offline PWA
const CACHE_NAME = 'studymate-v5';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './accounting.js',
  './accounting-ui.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install - cache core files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch - Cache first for local, network first for CDN
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // For local files - cache first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  // For CDN libs (pdf-lib, pdf.js, etc) - network first, cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(e.request, res.clone());
        return res;
      });
    }).catch(() => {
      return caches.match(e.request);
    })
  );
});
