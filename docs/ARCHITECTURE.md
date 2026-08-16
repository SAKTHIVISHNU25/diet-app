# Architecture

## Overview

MyLyf is a single Next.js application. There is no separate backend service: the App Router serves both the UI and the API, and Firebase provides the database, authentication and file storage.

```
┌─────────────────────────────────────────────────────────┐
│  Browser (installable PWA)                              │
│  React Server Components + Client Components            │
│  Service worker: static assets + offline fallback       │
└───────────────┬─────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────────────────┐
│  Next.js on Vercel                                      │
│                                                         │
│  middleware.ts       cookie-presence route guard (Edge)   │
│  app/(dashboard)/    server components, Admin SDK reads   │
│  app/api/*           route handlers, all auth-checked    │
│  lib/vision/         provider abstraction (swappable)    │
│  lib/usda/           nutrition client + normalisation    │
│  lib/diet/           offline template meal planner       │
│  lib/calculations/   pure BMR/TDEE/macro functions       │
└──────┬──────────────────────┬───────────────┬───────────┘
       │                      │               │
┌──────▼───────┐   ┌──────────▼──────┐  ┌─────▼──────────┐
│  Firebase    │   │  Hugging Face   │  │  USDA          │
│  Realtime DB │   │  Inference API  │  │  FoodData      │
│  Auth        │   │  nateraw/food   │  │  Central       │
│  Storage     │   │                 │  │                │
└──────────────┘   └─────────────────┘  └────────────────┘
```

Only the Next.js server talks to Hugging Face and USDA. Those API keys never reach the browser.

---

## Frontend

**Server Components by default.** Pages under `app/(dashboard)/` are async server components that read from Realtime Database via the Admin SDK, scoped to the verified session's uid. This means the first paint already contains real data — no loading spinner, no client-side fetch waterfall.

**Client Components only where interaction demands it.** Forms, the scan flow, editing sheets and the chart are `'use client'`. Each is a leaf, so the server-rendered shell stays cheap.

**Data mutation is split by purpose:**

- *Server Actions* for the profile form, which is tied to a page and benefits from `useActionState` error handling.
- *Client-side submit* for sign-in and sign-up, because Firebase Auth is a browser SDK — the form signs in, then exchanges the resulting ID token for a server session cookie.
- *Route Handlers* for everything the client mutates dynamically (food logs, weight entries, diet plans, analysis). These are a documented HTTP API, which keeps the client code plain `fetch` and makes the surface testable with `curl`.

**Layout.** A single `max-w-2xl` column with a fixed bottom navigation bar. `env(safe-area-inset-*)` keeps content clear of the notch and home indicator when installed.

---

## Backend

Every route handler follows the same shape:

```ts
1. requireUser()                   // verify the Firebase session cookie
2.                                 //   -> signature + revocation check
3. if (!user) return unauthenticated()
4. schema.safeParse(body)          // Zod validation
5. read/write at a path built from the session uid — never from the body
6. return apiSuccess(...) | apiError(code, friendlyMessage)
```

Two rules hold everywhere:

- **Identity comes from the verified session cookie, never from the request.** `verifySessionCookie(cookie, true)` checks the signature *and* that the session has not been revoked, rather than trusting the cookie's contents. A client-supplied user id is never used to build a path.
- **Internal detail never leaves the server.** `lib/utils/api.ts` logs the real error and returns a short, friendly message plus a stable machine-readable code.

**Where the security boundary actually is.** `middleware.ts` runs on the Edge runtime, where `firebase-admin` cannot, so it only checks whether a session cookie is *present*. That is a UX redirect, not a gate. Real verification happens on the Node runtime in three places: the dashboard layout before any user data renders, every route handler, and the Security Rules. A forged cookie earns a redirect to a page that immediately bounces back to `/login`, and no data.

---

## Firebase

**Database.** One JSON tree, with every user-owned record nested under its owner's uid. No schema and no migrations, so readers coerce defensively. See [DATABASE.md](DATABASE.md).

**Data scoping by path.** Everything a user owns lives under `/{collection}/{uid}/...`. Server code builds that path from the verified session, so a query is scoped before any rule runs — there is no shared index to forget to filter. Security Rules (`auth.uid === $uid` per subtree) are the second layer, and the only layer for the direct client access used by photo uploads.

**Auth.** Firebase Auth runs client-side, so a **session cookie** bridges it to the server: the client signs in, POSTs its ID token to `/api/auth/session`, and the server mints an httpOnly cookie with the Admin SDK. Server Components verify that cookie on every request.

**Storage.** Meal photos at `food-images/<uid>/`, with Storage Rules comparing that segment to the caller's uid and capping size and content type. Upload failure never blocks logging the food — Storage requires the Blaze plan, so it may not be enabled at all.

**The Admin SDK bypasses Security Rules.** That is why it is confined to `lib/firebase/admin.ts` and `server-only` modules, and why every server query derives its path from the verified uid. The service-account key is the one genuine secret in the environment; the `NEXT_PUBLIC_FIREBASE_*` config values are public by design.

---

## Vision provider abstraction

Nothing outside `lib/vision/` knows that Hugging Face exists.

```
lib/vision/
  types.ts             FoodVisionProvider, FoodAnalysis, VisionError
  provider.ts          registry + getFoodVisionProvider()
  huggingface.ts       HuggingFaceFoodProvider
  mock.ts              MockFoodProvider (offline, deterministic)
  portions.ts          category-based default portions
  food-recognition.ts  pipeline: provider -> identification -> USDA
```

A provider implements one method:

```ts
interface FoodVisionProvider {
  readonly name: string;
  analyzeImage(input: ImageInput): Promise<FoodAnalysis>;
}
```

Selection is by the `FOOD_VISION_PROVIDER` environment variable. An unknown value logs a warning and falls back to `mock` rather than crashing.

To add a provider — a local ONNX model, an object detector, a multimodal endpoint — implement the interface, register it in `provider.ts`, and set the environment variable. No other file changes. See [FOOD_RECOGNITION.md](FOOD_RECOGNITION.md).

The diet planner uses the same pattern (`lib/diet/provider.ts`) so an AI-backed planner can be added later without the template planner ever becoming unavailable.

---

## USDA integration

```
lib/usda/
  client.ts     HTTP client, timeout, typed UsdaError
  types.ts      API response types + nutrient numbers
  nutrition.ts  normalisation to the internal per-100 g shape
  search.ts     cache -> USDA -> cache fallback, plus result ranking
```

Lookups follow: exact cache hit → USDA API → fuzzy cache fallback if USDA is unreachable. The cache is a plain `food_cache` node in Realtime Database, not Redis, and a cache miss is never an error. See [NUTRITION.md](NUTRITION.md).

---

## Data flow: scanning a meal

```
1.  User picks or takes a photo
2.  Browser downscales it to ≤1024px and re-encodes as JPEG
      → typical 8 MB camera photo becomes ~150 KB
3.  POST /api/food/analyze  (multipart)
4.  Server: auth check → size check → MIME check → magic-byte check
5.  recognizeFood()
      → FoodVisionProvider.analyzeImage()
      → Hugging Face returns ranked Food-101 labels
6.  Below the confidence threshold?
      → return no candidate; UI asks the user to choose the food
7.  Above it?
      → searchFood(label) against cache/USDA for per-100 g nutrition
      → attach a category-default starting portion
8.  Response: candidates + alternatives + notes.  NOTHING IS LOGGED YET.
9.  User reviews: edit the name, change the portion, pick an alternative,
    search the database, add more foods, or delete the item
10. On save: photo uploads to Storage, POST /api/food/log writes the rows
11. router.refresh() re-renders the dashboard from the database
```

Step 8 is the important one. The model's output is a suggestion that the user must accept, not a measurement.

---

## Calculation layer

`lib/calculations/` contains only pure functions — no I/O, no framework imports:

- `bmr.ts` — Mifflin-St Jeor
- `tdee.ts` — activity multipliers, goal adjustment, safety floor
- `macros.ts` — protein/fat/carb split with floors and reconciliation
- `nutrition.ts` — per-100 g scaling and day totals
- `targets.ts` — composes the chain

Because they are pure, the dashboard, the diet planner and the tests all produce the same numbers by construction, and the whole layer is covered by unit tests without mocks.

---

## Key decisions

**Server Components for reads, route handlers for writes.** Reads benefit from no client round trip; writes benefit from being an explicit, documented, testable API.

**Per-user paths as the authorisation boundary.** Rather than trusting application code to filter correctly every time, the data is shaped so another user's records are not reachable from the path being read.

**A deterministic diet planner, not an AI one.** The core feature works offline, costs nothing, and cannot fail because of a rate limit or a missing key. The provider interface leaves room for an AI planner later.

**A deliberately conservative service worker.** Almost all data here is private and time-sensitive. Caching HTML would risk showing one account's data to another on a shared device and would present stale calorie totals as current. Only immutable build assets are cached; navigations are network-first with an honest offline page.

**Everything coerced at the boundary.** Realtime Database has no schema and no migrations, so old nodes keep old shapes forever. Every `lib/data/` reader normalises through `lib/firebase/converters.ts` — epoch-millis timestamps to ISO strings, numeric strings to numbers — so nothing downstream ever sees an unexpected type.
