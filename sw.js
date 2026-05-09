/* ═══════════════════════════════════════════════════════
   VLA Sales App — Service Worker
   Handles offline caching + automatic silent updates
═══════════════════════════════════════════════════════ */

// ── Bump this version string every time you deploy a new build ──
// The browser detects the change and triggers the update flow.
const CACHE_VERSION = 'vla-v2.2';
const CACHE_NAME = CACHE_VERSION;

// Files to cache for offline use
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Install: cache essential files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // If some assets are missing, still install — don't block
        return cache.add('./index.html');
      });
    })
  );
  // Do NOT call skipWaiting() here — we wait for the app to signal readiness
});

// ── Activate: delete old caches from previous versions ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin assets
  if(event.request.method !== 'GET') return;
  if(!event.request.url.startsWith(self.location.origin)) return;

  // For navigation (page loads): network-first so agents always get latest HTML
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache the fresh response for offline fallback
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For all other assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// ── Message handler: app signals the SW to take over immediately ──
// This is called by index.html when a new version is ready,
// triggering a silent automatic reload on all open tabs.
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
