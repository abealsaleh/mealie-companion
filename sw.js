const CACHE_NAME = 'mealie-companion-v9';
const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/manifest.json',
  '/js/main.js', '/js/app.js', '/js/lib.js', '/js/constants.js',
  '/js/utils.js', '/js/signals.js', '/js/api.js', '/js/auth.js',
  '/js/hooks.js',
  '/js/components/Icon.js', '/js/components/Toast.js', '/js/components/Modal.js',
  '/js/components/Autocomplete.js', '/js/components/LoginForm.js',
  '/js/components/TabNav.js', '/js/components/MealPlan.js',
  '/js/components/ShoppingList.js', '/js/components/IngredientModal.js',
  '/js/components/ListPicker.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache API calls
  if (url.pathname.startsWith('/api/')) return;

  // Same-origin assets: network-first (always get fresh content, fall back to cache offline)
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Third-party CDN assets: cache-first (immutable versioned URLs)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
