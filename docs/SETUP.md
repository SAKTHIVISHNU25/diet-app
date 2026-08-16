# Setup

Getting Diet AI running locally, from nothing to a working app.

---

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or later | `node -v` |
| npm | 10 or later | Ships with Node 20 |
| Firebase project | Spark (free) | https://console.firebase.google.com |
| USDA API key | free | https://fdc.nal.usda.gov/api-key-signup.html |
| Hugging Face account | free | Only for real food recognition |

No Docker, no local database, no Python.

---

## 1. Install

```bash
git clone <your-repo-url>
cd diet-ai
npm install
cp .env.example .env.local
```

---

## 2. Firebase

### Create the project

1. Go to https://console.firebase.google.com and create a project (or use an existing one).
2. Google Analytics is optional — this app does not use it.

### Register a web app

**Project settings → General → Your apps → Add app → Web (`</>`)**.

Firebase shows a config block. Copy those values into `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abc123
```

These are **public by design** — they identify the project and ship in client JavaScript. They grant no access on their own; Security Rules do that. `measurementId` is not needed.

### Enable Email/Password sign-in

**Authentication → Get started → Sign-in method → Email/Password → Enable.**

Leave "Email link (passwordless sign-in)" off. If you skip this step, signup fails with *"Email sign-in is not enabled for this project."*

Email verification is not required by this app. For a private two-person app that is usually what you want.

### Create the Realtime Database

**Build → Realtime Database → Create Database.**

1. Pick a region. **This changes the URL**, so note which you chose.
2. Start in **locked mode** — the rules in this repo replace the defaults in the next step.

Copy the URL shown at the top of the page into `.env.local`:

```bash
# us-central1
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# europe-west1
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.europe-west1.firebasedatabase.app

# asia-southeast1
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
```

> Getting the region wrong is the most common setup mistake here. Sign-in works fine, and then every data read silently returns nothing.

### Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id

firebase deploy --only database
firebase deploy --only storage    # only if Storage is enabled — see below
```

Or paste `database.rules.json` into **Realtime Database → Rules** and publish.

Do this before using the app in earnest. Test-mode rules are world-readable and expire after 30 days, at which point everything stops working with no obvious cause.

### Service account key (required)

The server reads and writes through the Admin SDK, which needs credentials.

**Project settings → Service accounts → Generate new private key.** A JSON file downloads.

This one **is** a genuine secret: it bypasses every security rule. Never commit it, never prefix it with `NEXT_PUBLIC_`.

Put it in `.env.local` as a single line:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

Base64 is easier and less error-prone, especially for Vercel — the app accepts either:

```bash
base64 -w0 ~/Downloads/your-project-firebase-adminsdk.json
```

```bash
FIREBASE_SERVICE_ACCOUNT_KEY=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIs...
```

### Storage (optional)

Only needed to save meal photos. **Build → Storage → Get started.**

> Firebase generally requires the **Blaze** (pay-as-you-go) plan to enable Cloud Storage on new projects. Everything else here — Auth, Realtime Database, hosting on Vercel — works on the free Spark plan.

If you skip Storage, the app still works: photos are analysed in memory and simply not saved, and the upload failure is logged rather than surfaced. See [LIMITATIONS.md](LIMITATIONS.md).

---

## 3. Data encryption key

Food logs, diet plans, planned meals and weigh-ins are encrypted with AES-256-GCM before they reach Realtime Database, so the app will not start without a key. Profiles are deliberately left readable — see [DATABASE.md](DATABASE.md#encryption-at-rest) for why.

```bash
openssl rand -base64 32
```

Put the result in `.env.local`:

```bash
DATA_ENCRYPTION_KEY=your-generated-key
```

**Server-only, and the one secret with no recovery path.** Losing it means losing every encrypted record — a database export without the key is unreadable. Use a different key in production, and back it up somewhere other than the database.

If you already have data in the database from before encryption, convert it once:

```bash
npm run encrypt:migrate -- --dry-run   # preview
npm run encrypt:migrate                # convert
```

Records already encrypted are skipped, so it is safe to re-run.

---

## 4. USDA FoodData Central

1. Request a key at https://fdc.nal.usda.gov/api-key-signup.html — it arrives by email, usually immediately.
2. Set it in `.env.local`:

```bash
USDA_API_KEY=your-key-here
```

**Server-only.** It is read exclusively in `lib/usda/client.ts` and sent as an `X-Api-Key` header, never in a URL, so it cannot leak into logs.

Free tier: 1,000 requests per hour. Two users will not get near it, especially with the `food_cache` node absorbing repeats.

Without this key the app still runs — nutrition search falls back to the cache and says so.

### Seed the food cache (recommended)

```bash
node scripts/seed-food-cache.mjs
```

Writes ~40 common foods (including South Asian staples the recognition model does not know) into `food_cache`. Needs `FIREBASE_SERVICE_ACCOUNT_KEY` and the database URL. Safe to run twice.

---

## 5. Hugging Face (optional)

Needed only when `FOOD_VISION_PROVIDER=huggingface`.

1. Create an account at https://huggingface.co.
2. **Settings → Access Tokens** → **Create new token**.

   > **This is the step that catches people.** If you create a *fine-grained*
   > token, you must tick **"Make calls to Inference Providers"** under
   > Permissions. A fine-grained token with only repository scopes authenticates
   > fine but is rejected at inference time with HTTP 403:
   >
   > ```
   > This authentication method does not have sufficient permissions
   > to call Inference Providers on behalf of user <you>
   > ```
   >
   > The simplest option is a classic **Read** token, which includes inference
   > access by default.
3. Set it in `.env.local`:

```bash
FOOD_VISION_PROVIDER=huggingface
HF_TOKEN=hf_your_token_here
HF_FOOD_MODEL=nateraw/food
```

The default model is `nateraw/food`, a ViT fine-tuned on Food-101 (Apache-2.0, 101 classes). Read [FOOD_RECOGNITION.md](FOOD_RECOGNITION.md) before changing it — it sets out exactly what this model can and cannot do.

**Notes on the Inference API**

- Requests go to `https://router.huggingface.co/hf-inference/models/<model>`. The older `api-inference.huggingface.co` host has been retired.
- A cold model returns **503 while it loads**. The app surfaces this as *"The recognition model is starting up. Please try again in a few seconds."* Retrying usually works.
- Serverless quotas are set by Hugging Face and can change. For guaranteed availability, deploy to a dedicated Inference Endpoint (paid) and set `HF_INFERENCE_URL`.

**Developing without a token:** set `FOOD_VISION_PROVIDER=mock`. Recognition returns deterministic local results with no network calls — this is also what the test suite uses.

---

## 6. Your `.env.local`

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abc123
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

DATA_ENCRYPTION_KEY=base64-32-bytes-from-openssl

USDA_API_KEY=your-usda-key

FOOD_VISION_PROVIDER=mock
HF_TOKEN=
HF_FOOD_MODEL=nateraw/food

DIET_PLAN_PROVIDER=template
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is git-ignored. Next.js reads it **only at startup** — restart the dev server after editing it.

---

## 7. Check the configuration

Before opening the app, run the preflight check:

```bash
npm run check:firebase
```

It verifies the whole chain in one go, because every failure below looks identical in the browser:

- every `NEXT_PUBLIC_FIREBASE_*` value is present and not a placeholder
- the service account parses **and belongs to the same project as the web config** — a mismatch is the nastiest failure mode here, because sign-up appears to succeed and only then does every request fail on an audience mismatch
- Authentication is enabled and Email/Password is switched on
- the Realtime Database exists at the configured URL, in the right region
- the Admin SDK can genuinely read and write
- it warns if the database is still world-readable under test-mode rules

Fix anything it reports before moving on.

---

## 8. Run it

```bash
npm run dev
```

Open http://localhost:3000, create an account, and complete onboarding. You should land on a dashboard showing your calculated targets.

---

## 9. Verify

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

End-to-end:

```bash
npm run build
npm run test:e2e
```

Public specs (routing, auth protection, API guards, PWA) run with no credentials. Authenticated specs skip unless you provide an account:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=yourpassword npm run test:e2e
```

Use a throwaway account that has already completed onboarding — these tests write real food logs, weight entries and diet plans.

---

## Regenerating the app icons

```bash
node scripts/generate-icons.mjs
```

Writes `public/icons/*.png` using `sharp` (already a Next.js dependency). Copy `icon-192.png` to `app/icon.png` and `apple-touch-icon.png` to `app/apple-icon.png` if you change the artwork.

---

## Troubleshooting

**`auth/operation-not-allowed` on signup**
Email/Password is not enabled. Firebase Console → Authentication → Sign-in method.

**`auth/api-key-not-valid`**
`NEXT_PUBLIC_FIREBASE_API_KEY` is wrong or missing. Restart the dev server after fixing it.

**`auth/network-request-failed`**
No connection, or `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is wrong.

**Sign-in appears to work but you land back on `/login`**
The session cookie exchange failed. Almost always `FIREBASE_SERVICE_ACCOUNT_KEY` — unset, malformed, or from a different project. Check the server console for `[api:auth/session]`.

**Signed in, but the dashboard is empty and saving does nothing**
Usually the wrong `NEXT_PUBLIC_FIREBASE_DATABASE_URL` region, or rules that were never deployed. Check the Firebase Console → Realtime Database → Data to see whether nodes are being written.

**`PERMISSION_DENIED` in the console**
Rules are not deployed, or a test-mode database's open rules have expired. Run `firebase deploy --only database`.

**"Index not defined" warning**
`.indexOn` is missing. Deploy `database.rules.json`; results are still correct, just sorted client-side.

**Photo uploads silently do nothing**
Storage is not enabled (it needs the Blaze plan), or its rules are not deployed. Food still logs without the photo, by design.

**"Nutrition lookup is not configured"**
`USDA_API_KEY` is unset. The app falls back to the cache — run the seed script if it is empty.

**Recognition always says "could not be identified confidently"**
Expected for foods outside the 101 Food-101 classes. See [LIMITATIONS.md](LIMITATIONS.md).

**The install banner never appears**
It needs HTTPS (or localhost), a registered service worker, and a valid manifest — and Chrome fires the event only once per site until conditions change. See [PWA.md](PWA.md).
