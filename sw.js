// BUMPED TO v3: This tells the browser to delete the old narrow design and cache the new one
const CACHE_NAME = 'qr-lab-v3';

const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/ui.js',
  './js/bulk.js',
  './manifest.json',
  './icon-192.png',
  'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', event => {
  // Skip waiting forces the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Successfully cached app files for offline use (v3)');
      return cache.addAll(assetsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  // Take control of all pages immediately without waiting for a refresh
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
        console.log('You are offline.');
    })
  );
});