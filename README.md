# MyLyf

A mobile-first, installable diet and calorie tracking app. Photograph a meal, confirm what it is, and MyLyf handles the calories and macros using nutrition data from USDA FoodData Central.

Built as a private app for a small number of users, on free infrastructure, with no dependency on any paid AI API.

---

## Features

- **Email/password accounts** via Firebase Auth, with an httpOnly session cookie so pages still render on the server.
- **Onboarding** that collects the details needed to estimate your energy needs.
- **Calorie and macro targets** derived from BMR (Mifflin-St Jeor) → TDEE → goal adjustment → macro split.
- **Food photo scanning** using an open-source Food-101 image classifier hosted on Hugging Face.
- **Mandatory user confirmation** — a recognition result is only ever a suggestion; nothing is logged until you approve it.
- **USDA FoodData Central** nutrition lookup, with a database-backed cache and a manual search fallback.
- **Daily food log** with add, edit and delete, grouped by meal.
- **7-day diet plan** generated offline from your targets, dietary preference and allergies. Meals can be edited or swapped.
- **Weight tracking** with a trend chart and goal line.
- **30-day history** of everything you logged.
- **Daily journal** — one encrypted entry per day with a mood and writing prompts, browsed through a month calendar that marks the days you wrote, plus a streak, a mood mix summary and search across everything you have written.
- **Daily review** — a second tab on the journal page for what went well, what went wrong and what needs to improve, with one-tap suggestions, yesterday's focus carried forward, and its own calendar of reviewed days. Stored on the same day's entry, shown only in its own tab.
- **Installable PWA** — add to your home screen from Chrome and it launches standalone with no address bar.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 3 + shadcn/ui-style components on Radix primitives |
| Backend | Next.js Route Handlers and Server Actions |
| Database | Firebase Realtime Database (Admin SDK server-side) |
| Auth | Firebase Auth + Admin SDK session cookies |
| Storage | Firebase Storage (per-user paths) |
| Food vision | Hugging Face Inference API — `nateraw/food` (ViT / Food-101, Apache-2.0) |
| Nutrition | USDA FoodData Central API |
| Validation | Zod |
| Charts | Recharts |
| Tests | Vitest (unit) + Playwright (e2e) |
| Hosting | Vercel |

There is no Express, no separate backend, no Docker, no Redis, and no state management library. Everything runs inside Next.js.

---

## Installation

Requires **Node.js 20 or later**.

```bash
git clone <your-repo-url>
cd mylyf
npm install
cp .env.example .env.local
```

Fill in `.env.local`, then deploy the security rules (see [docs/SETUP.md](docs/SETUP.md)).

---

## Development

```bash
npm run dev            # dev server on http://localhost:3000
npm run check:firebase # verify Firebase config before anything else
npm run seed           # seed the food cache (~40 common foods)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests
npm run build          # production build
npm run start          # serve the production build
```

If sign-in misbehaves, run `npm run check:firebase` first — it catches the
configuration mistakes that all surface as the same vague error in the browser.

To develop without any external services, set `FOOD_VISION_PROVIDER=mock`. Recognition then returns deterministic local results and never calls the network. You still need Firebase for auth and data.

---

## Environment variables

Full descriptions are in [`.env.example`](.env.example).

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | public | yes | Web SDK config — public by design |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | public | yes | Realtime Database URL (region-specific) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **server only** | yes | Admin SDK — a genuine secret |
| `DATA_ENCRYPTION_KEY` | **server only** | yes | AES-256-GCM key for user data at rest |
| `DATA_ENCRYPTION_KEYS_PREVIOUS` | **server only** | no | Retired keys, decrypt-only, for rotation |
| `USDA_API_KEY` | **server only** | yes | USDA FoodData Central |
| `HF_TOKEN` | **server only** | only for `huggingface` | Hugging Face Inference API |
| `FOOD_VISION_PROVIDER` | server | no | `huggingface` (default) or `mock` |
| `HF_FOOD_MODEL` | server | no | Defaults to `nateraw/food` |
| `HF_INFERENCE_URL` | server | no | Override for a dedicated Inference Endpoint |
| `DIET_PLAN_PROVIDER` | server | no | `template` (default) |
| `NEXT_PUBLIC_SITE_URL` | public | no | Used to build auth email redirect links |

Server-only variables must **never** be prefixed with `NEXT_PUBLIC_`. The `NEXT_PUBLIC_FIREBASE_*` values are safe to expose — they identify the project and grant no access. `FIREBASE_SERVICE_ACCOUNT_KEY` is the opposite: it bypasses every security rule.

Generate the encryption key with `openssl rand -base64 32`. **Losing it means losing the data** — food logs, diet plans and weigh-ins cannot be recovered without it. Back it up somewhere other than the database it protects. See [docs/DATABASE.md](docs/DATABASE.md#encryption-at-rest) for what is encrypted and what is not.

---

## Deployment

Deploy to Vercel, point it at your Firebase project, and set the environment variables in the Vercel dashboard. Step-by-step instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Installing as a PWA (Chrome)

**Android / desktop Chrome**

1. Open the deployed site over HTTPS and sign in.
2. Chrome shows an in-app "Install MyLyf" banner — tap **Install**.
3. If you dismissed it, use the browser menu (⋮) → **Install app** / **Add to Home screen**.

After installing, the app gets its own icon, launches standalone without the address bar, and camera upload continues to work.

**iOS Safari** does not support the install prompt; use **Share → Add to Home Screen** instead. Behaviour differs from Chrome — see [docs/PWA.md](docs/PWA.md) and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

---

## Documentation

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and data flow |
| [SETUP.md](docs/SETUP.md) | Local setup, Firebase, USDA, Hugging Face |
| [DATABASE.md](docs/DATABASE.md) | Data tree, security rules, indexes |
| [API.md](docs/API.md) | Every route, request and response shape |
| [FOOD_RECOGNITION.md](docs/FOOD_RECOGNITION.md) | Vision architecture, selected model, its real limits |
| [NUTRITION.md](docs/NUTRITION.md) | USDA integration and nutrition maths |
| [DIET_PLAN.md](docs/DIET_PLAN.md) | BMR/TDEE/macros and the meal planner |
| [PWA.md](docs/PWA.md) | Manifest, service worker, installability |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel and Firebase production setup |
| [LIMITATIONS.md](docs/LIMITATIONS.md) | What this app cannot do well |

---

## Disclaimer

Nutrition and calorie values are estimates and should not be considered medical advice. Consult a qualified healthcare professional for medical or dietary conditions.
