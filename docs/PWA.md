# Progressive Web App

MyLyf installs from Chrome and runs standalone, like a native app.

---

## Manifest

`public/manifest.webmanifest`, linked from the root layout via Next.js metadata.

```json
{
  "name": "MyLyf",
  "short_name": "MyLyf",
  "id": "/dashboard",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#1b7a55",
  "categories": ["health", "fitness", "lifestyle"]
}
```

Notes on the choices:

- **`start_url: /dashboard`** — launching straight into today's numbers is what the app is for. Signed-out users are redirected to `/login` by the middleware, so this is safe.
- **`scope: /`** — every route stays inside the installed app; no link kicks you out to the browser.
- **`id`** — pins the app's identity so changing `start_url` later does not create a second installed app.
- **`display_override`** — `minimal-ui` as a graceful fallback where `standalone` is unsupported.

### Shortcuts

Long-pressing the installed icon offers **Scan food** and **Diet plan** as jump targets.

---

## Icons

Generated from a single inline SVG by `scripts/generate-icons.mjs` (using `sharp`, already a Next.js dependency):

| File | Size | Purpose |
|---|---|---|
| `icons/icon-192.png` | 192×192 | `any` |
| `icons/icon-512.png` | 512×512 | `any` — also used for splash screens |
| `icons/maskable-192.png` | 192×192 | `maskable` |
| `icons/maskable-512.png` | 512×512 | `maskable` |
| `icons/apple-touch-icon.png` | 180×180 | iOS home screen |
| `app/icon.png` | 192×192 | Favicon, via the Next.js file convention |
| `app/apple-icon.png` | 180×180 | Apple touch icon, via the file convention |

Chrome requires **both** a 192px and a 512px icon before it will offer installation.

**Maskable icons matter.** Android launchers clip icons to a device-specific shape (circle, squircle, teardrop). A maskable icon must keep its content inside a central safe zone — the artwork is rendered with 28% padding and no rounding, so the launcher's own mask does the shaping. Without these, Android crops the standard icon and the result looks broken.

To change the artwork, edit the SVG in `scripts/generate-icons.mjs`, run `node scripts/generate-icons.mjs`, then copy `icon-192.png` to `app/icon.png` and `apple-touch-icon.png` to `app/apple-icon.png`.

---

## Service worker

`public/sw.js`, registered by `components/shared/service-worker-registrar.tsx` **in production only**. In development any previously installed worker is actively unregistered, because a cached worker fights hot reload.

### Caching strategy — and why it is conservative

| Request | Strategy |
|---|---|
| `/_next/static/*`, `/icons/*`, `/images/*`, manifest | **Cache first** — content-hashed and immutable |
| Navigations | **Network first**, falling back to `/offline.html` |
| `/api/*`, `/auth/*` | **Never intercepted** |
| Cross-origin (Firebase, USDA, Hugging Face) | **Never intercepted** |
| Non-GET | **Never intercepted** |

HTML and API responses are deliberately not cached. Almost everything in this app is private, per-user and time-sensitive. Caching pages would mean:

- a shared device could show one account's data to another after signing out, and
- stale calorie totals would be presented as current, which is worse than showing nothing.

The result is an app that opens instantly (shell assets are local), works installed, and is honest when there is no connection.

`next.config.mjs` serves `/sw.js` with `Cache-Control: no-cache, no-store, must-revalidate` so a new worker is never blocked by a stale cached copy.

### Versioning

The cache name embeds a version (`mylyf-static-v1`). On `activate`, every `mylyf-*` cache that is not the current one is deleted. Bump `VERSION` in `sw.js` when you change caching behaviour.

`skipWaiting()` and `clients.claim()` mean a new worker takes over immediately rather than waiting for every tab to close.

---

## Offline behaviour

Navigating while offline serves `public/offline.html` — a self-contained page (inline CSS, no external requests, light and dark aware) that says plainly what is unavailable and that saved data is safe.

**What does not work offline:** logging food, nutrition lookup, photo analysis, plan generation, weight entry, and loading any page you have not already got open. All of them need the database or an external API.

This is a deliberate limit, not an oversight. Offline write queueing with later sync would need conflict resolution and a local mirror of private data — a large amount of machinery, and a meaningful privacy trade-off, for a two-user app.

---

## Installation

### Android Chrome

1. Open the site over HTTPS and sign in.
2. The in-app install banner appears — tap **Install**.
3. Or use ⋮ → **Install app** / **Add to Home screen**.

### Desktop Chrome / Edge

1. Open the site over HTTPS.
2. Click the install icon (⊕) in the address bar, or ⋮ → **Cast, save and share → Install page as app**.

### iOS Safari

iOS does not support `beforeinstallprompt`, so no in-page prompt is possible. Use **Share → Add to Home Screen**. The app still launches standalone thanks to `apple-mobile-web-app-capable` and the Apple touch icon.

### Installability requirements

Chrome will only offer installation when all of these hold:

- Served over **HTTPS** (or `localhost`)
- A valid, reachable manifest with `name`, `short_name`, `start_url`, `display: standalone`
- Icons at both 192px and 512px
- A registered service worker with a `fetch` handler
- The app is not already installed

All are satisfied by a Vercel deployment with no extra configuration.

---

## The install prompt

`hooks/use-install-prompt.ts` and `components/shared/install-prompt.tsx`.

```ts
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();     // suppress Chrome's own mini-infobar
  setDeferredPrompt(event);   // so our banner is the only prompt
});
```

Rules the banner follows:

1. **Only when Chrome says it can install.** `canInstall` is true only after the event actually fires, so the banner never advertises an install that would not work.
2. **Never when already installed.** Detected via `matchMedia('(display-mode: standalone)')` and, on iOS, `navigator.standalone`.
3. **Never again after dismissal.** A flag in `localStorage` (`mylyf:install-dismissed`) is checked after mount, so server and client markup match and there is no hydration mismatch. Declining the native dialog also sets it — being asked twice is annoying.
4. **Cleared on install.** The `appinstalled` event clears the deferred prompt and re-checks display mode.

`localStorage` access is wrapped in `try/catch` — private browsing can block it, and that should not break the page.

---

## Standalone behaviour

**Safe areas.** The app pads for the notch and home indicator:

```css
body { padding-top: env(safe-area-inset-top); }
.pb-safe-nav { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
```

with `viewportFit: 'cover'` in the viewport metadata so the app can draw into those regions.

**Theme colour** adapts to the system scheme (`#ffffff` light, `#101a16` dark), so the status bar matches the app.

**Zoom is not blocked.** `maximumScale: 5` and no `user-scalable=no` — capping zoom would fail WCAG 1.4.4. This is asserted in the e2e tests.

**Touch targets** are at least 44px; nav items are 64px tall.

---

## Camera in standalone mode

Camera capture uses plain file inputs rather than `getUserMedia`, which keeps it working identically in the browser and installed:

```html
<!-- Opens the rear camera directly on mobile -->
<input type="file" accept="image/*" capture="environment" />

<!-- Opens the gallery / file browser -->
<input type="file" accept="image/jpeg,image/png,image/webp" />
```

Two separate inputs are needed: on Android Chrome a single input cannot offer both camera and gallery reliably. Desktop additionally supports drag and drop.

The browser handles the permission prompt. No camera permission is requested until the user taps **Take photo**.

---

## Testing the PWA

`e2e/public.spec.ts` asserts, on every run:

- The manifest is valid JSON with the required fields and `display: standalone`.
- Icons at 192px and 512px exist, **and every icon URL in the manifest actually serves a PNG**.
- At least one maskable icon is declared.
- The manifest is linked from the page and a `theme-color` is present.
- `/sw.js` is served with no-cache headers.
- `/offline.html` is served.
- The viewport permits zooming.

Manually, in Chrome DevTools:

- **Application → Manifest** — check for installability warnings.
- **Application → Service Workers** — confirm it is activated and running.
- **Lighthouse → PWA** — run the audit against the deployed HTTPS URL.
- **Network → Offline** — reload and confirm the offline page appears.

Note that installability cannot be fully verified on `localhost` over plain HTTP in every Chrome version; test against the real deployment.

---

## Browser support

Support is genuinely uneven. Do not assume parity.

| Feature | Chrome/Edge (Android, desktop) | Safari (iOS) | Firefox |
|---|---|---|---|
| Install from a manifest | Yes | Manual: Add to Home Screen | Android only; no desktop install |
| `beforeinstallprompt` | Yes | **No** | **No** |
| Standalone display | Yes | Yes | Android only |
| Service worker | Yes | Yes | Yes |
| Maskable icons | Yes | Ignored | Partial |
| App shortcuts | Yes | **No** | **No** |
| `capture="environment"` | Yes | Yes | Yes |
| Safe-area insets | Yes | Yes | Yes |

**iOS specifics worth knowing:** no install prompt is possible; storage for a home-screen app can be evicted after roughly seven days of non-use (which affects the dismissal flag, not your data — that lives in Firebase); and push notifications require iOS 16.4+ and an installed app. This app does not use push — reminders are scheduled locally in the page (see `lib/notifications/reminders.ts`) and only fire while the app is running, though the service worker does handle the resulting `notificationclick`.

The in-app install banner is Chromium-only by construction. Elsewhere the app still works fully as a website, and can still be added to the home screen manually.
