/* eslint-disable no-restricted-globals */
/**
 * Diet AI service worker.
 *
 * Scope is deliberately narrow. This app is almost entirely personal, private,
 * per-user data, so caching HTML responses would risk showing one account's
 * data to another after a device is shared, and would show stale calorie totals
 * that look authoritative. Instead:
 *
 *   - Static build assets and icons: cache-first (immutable, content-hashed).
 *   - Navigations: network-first, falling back to an offline page.
 *   - API requests: never cached, never intercepted.
 *
 * The result is a genuinely installable app that opens instantly and degrades
 * honestly when offline, rather than one that lies about your data.
 */

const VERSION = 'v1';
const STATIC_CACHE = `diet-ai-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // A missing precache entry must not block installation.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('diet-ai-') && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; everything else goes straight to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only — never touch Supabase, USDA or any third party.
  if (url.origin !== self.location.origin) return;

  // Never cache API responses or auth callbacks: they are private and change
  // constantly. Letting them fall through means no stale personal data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Navigations: network first, offline page as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ??
          new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      }),
    );
    return;
  }

  // Build output and icons are content-hashed or stable — cache first.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/manifest.webmanifest';

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache complete, successful responses.
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
