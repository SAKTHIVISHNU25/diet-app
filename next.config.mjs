/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    /**
     * How long an already-visited route stays reusable from the client-side
     * Router Cache before the router goes back to the server for it.
     *
     * Next 15 defaults `dynamic` to 0, which means every tap on the bottom nav
     * is a fresh server render — a session verify plus a database read — even
     * when the user is just bouncing between two pages they opened seconds
     * ago. Holding the payload for 30s makes that back-and-forth instant, with
     * no server round trip at all.
     *
     * This is only safe because every mutation in the app already calls
     * `router.refresh()` (see the food, journal, progress, diet and profile
     * clients), which drops the whole Router Cache. So the cache can never
     * survive a write — it only shortcuts pure navigation. If you add a new
     * write path, it must call `router.refresh()` too.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // The service worker and manifest are static files in /public. These headers make
  // sure Chrome always revalidates the service worker instead of serving a stale one.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
