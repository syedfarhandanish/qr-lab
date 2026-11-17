// QR Lab service worker
// Bump VERSION whenever the app shell changes so clients pick up the new files.
const VERSION = 'v5';
// One cache, so background refreshes overwrite the precached copies
const CACHE = `qr-lab-${VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/404.html',
  '/style.css',
  '/js/main.js',
  '/js/ui.js',
  '/js/bulk.js',
  '/js/site.js',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/sprite.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Third-party libraries pinned to exact versions: safe to cache forever
const CDN_ASSETS = [
  'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    // CDN files are best-effort: a CDN hiccup must not block installation
    await Promise.all(CDN_ASSETS.map(url =>
      fetch(url, { mode: 'cors' }).then(res => res.ok && cache.put(url, res)).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('qr-lab-') && key !== CACHE)
      .map(key => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache analytics
  if (url.pathname.startsWith('/_vercel/')) return;

  // Pages: network first (fresh content for users and crawlers), cache fallback offline
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        const response = preload || await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
        return response;
      } catch (e) {
        return (await caches.match(request, { ignoreSearch: true })) ||
               (await caches.match('/index.html')) ||
               Response.error();
      }
    })());
    return;
  }

  // Pinned CDN libraries and Google Fonts: cache first
  if (CDN_ASSETS.includes(request.url) || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin assets and font CSS: stale-while-revalidate
  if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}
