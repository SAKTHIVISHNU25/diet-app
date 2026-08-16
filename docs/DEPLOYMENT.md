# Deployment

Deploying Diet AI to Vercel with a Firebase backend. Both free tiers cover a handful of users.

---

## Overview

| Component | Where | Cost |
|---|---|---|
| Next.js app | Vercel | Free (Hobby) |
| Auth, Realtime Database | Firebase Spark | Free |
| Meal photo storage | Firebase Storage | **Requires Blaze** — see below |
| Nutrition data | USDA FoodData Central | Free |
| Food recognition | Hugging Face Inference API | Free tier |

Everything except photo storage runs at **$0/month**.

> Firebase generally requires the **Blaze** (pay-as-you-go) plan to enable Cloud Storage on new projects. The app is fully functional without it — photos are analysed in memory and simply not saved. If you enable Blaze, set a budget alert; storage for two users costs pennies, but the plan is metered.

---

## 1. Prepare Firebase for production

You can reuse your development project. For two users, one project is fine.

1. **Authentication → Sign-in method** — Email/Password enabled.
2. **Realtime Database** — created, and note its exact URL (region-specific).
3. **Deploy the rules** — this is the step people skip:

```bash
firebase deploy --only database
firebase deploy --only storage    # only if Storage is enabled
```

Test-mode rules are world-readable and expire after 30 days. Check **Realtime Database → Rules** shows your rules, not the defaults.

4. **Project settings → Service accounts → Generate new private key.**

---

## 2. Deploy to Vercel

### Import the repository

1. Push your code to GitHub, GitLab or Bitbucket.
2. Go to https://vercel.com/new and import the repository.
3. Vercel detects Next.js — leave the build settings alone.

### Set environment variables

**Settings → Environment Variables**, applied to Production, Preview and Development:

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | Public |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | Public |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `your-project` | Public |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` | Public |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `000000000000` | Public |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:...:web:...` | Public |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | your RTDB URL | Public, **region-specific** |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | service account JSON | **SECRET** |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` | **SECRET**, unrecoverable |
| `DATA_ENCRYPTION_KEYS_PREVIOUS` | retired keys, comma-separated | **SECRET**, only when rotating |
| `USDA_API_KEY` | your key | **SECRET** |
| `HF_TOKEN` | `hf_...` | **SECRET** |
| `FOOD_VISION_PROVIDER` | `huggingface` | |
| `DIET_PLAN_PROVIDER` | `template` | |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | |

**Use a different `DATA_ENCRYPTION_KEY` in production than in development**, and store a copy of it somewhere other than the Firebase project it protects — a password manager, not a database backup. It encrypts every food log, diet plan and weigh-in; if it is lost, so is that data, and no Firebase export will bring it back. If the production database already holds plaintext records from before encryption, run `npm run encrypt:migrate` against it once the key is set (take a Console export first).

**The service account key needs care.** The raw JSON contains literal newlines inside `private_key`, which Vercel's environment editor mangles. Base64-encode it instead — the app decodes either form:

```bash
base64 -w0 your-project-firebase-adminsdk.json
```

Anything not prefixed `NEXT_PUBLIC_` stays server-side and is never bundled into client JavaScript. The `NEXT_PUBLIC_FIREBASE_*` values are safe to expose; `FIREBASE_SERVICE_ACCOUNT_KEY` absolutely is not — it bypasses every security rule.

### Deploy

Click **Deploy**. The first build takes a couple of minutes.

---

## 3. Authorise the domain in Firebase

Firebase Auth rejects sign-in attempts from unlisted domains.

**Authentication → Settings → Authorized domains** — add:

- `your-app.vercel.app`
- your custom domain, if you add one

`localhost` is authorised by default. Vercel preview deployments get unique subdomains, so if you want auth working on previews either add them as they appear or use a custom preview domain.

---

## 4. Verify

```bash
BASE=https://your-app.vercel.app

curl -s -o /dev/null -w "%{http_code}\n" $BASE/

# Protected routes must redirect
curl -s -o /dev/null -w "%{http_code}\n" $BASE/dashboard          # 307

# API must reject unauthenticated requests
curl -s $BASE/api/progress
# -> {"error":{"code":"unauthenticated","message":"Please sign in to continue."}}

# Session endpoint must reject a bogus token
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"idToken":"aaaaaaaaaaaaaaaaaaaaaaaa"}' $BASE/api/auth/session   # 401

# PWA assets
curl -s -o /dev/null -w "%{http_code}\n" $BASE/manifest.webmanifest
curl -s -o /dev/null -w "%{http_code}\n" $BASE/sw.js
```

Then in a browser:

1. Sign up and complete onboarding.
2. Check the dashboard shows sensible targets, and that **Realtime Database → Data** in the Firebase Console now contains a `profiles/{uid}` node.
3. Scan a photo — confirm you get a result or a clear failure, and that nothing is logged until you press save.
4. Generate a diet plan, add a weight entry.
5. Install from Chrome and confirm it launches standalone.

The public e2e suite also runs against production:

```bash
E2E_BASE_URL=https://your-app.vercel.app npx playwright test e2e/public.spec.ts
```

---

## 5. Custom domain (optional)

1. **Vercel → Settings → Domains**, add it and follow the DNS instructions.
2. Update `NEXT_PUBLIC_SITE_URL` and redeploy.
3. Add the domain to **Firebase → Authentication → Authorized domains**.

HTTPS is automatic, which the PWA requires.

---

## Restricting signups

The app has no invite system — anyone with the URL could create an account. Firebase has no one-click "disable signup" switch for Email/Password, so pick one of:

- **Delete unexpected accounts** as they appear (fine for two users, and you will notice).
- **Add an allowlist check** in `POST /api/auth/session`: reject any `decoded.email` not in a small list, so an account can exist but never obtain a server session. About five lines, and it fails closed.
- **Firebase App Check** — heavier, but blocks automated abuse of the Auth endpoints properly.

---

## Free-tier limits

### Vercel Hobby

| Limit | Value |
|---|---|
| Bandwidth | 100 GB/month |
| Function duration | 10s default |
| Commercial use | **Not permitted** on Hobby |

The 10-second function limit is the one to watch: `/api/food/analyze` allows Hugging Face 30 seconds, so a cold model start can exceed the platform limit and return a platform error before the app's own timeout fires. The user sees a failure and can retry — the model is usually warm by then.

### Firebase Spark (free)

| Limit | Value |
|---|---|
| Realtime Database storage | 1 GB |
| Realtime Database download | 10 GB/month |
| Simultaneous connections | 100 |
| Auth (email/password) | Unlimited |
| Cloud Storage | **Not available — needs Blaze** |

Two things worth knowing:

- **Download, not reads, is what's metered.** Realtime Database bills by bytes transferred, and it fetches whole subtrees. This is why meals are stored as a sibling of plans rather than nested inside them, and why the food cache is kept small — a careless `ref('food_logs/uid').get()` on years of data would pull all of it.
- **No project pausing.** Unlike some free tiers, Firebase does not pause an idle project.

### USDA

1,000 requests/hour per key. The `food_cache` node absorbs repeats, so real usage stays far below it.

### Hugging Face

Free serverless quotas are set by Hugging Face and can change. Exhausting them surfaces as `rate_limited` with a clear message; manual food entry keeps working.

---

## Monitoring

- **Vercel → Deployments → Runtime Logs** — server errors. Every handled failure logs with a `[api:route]`, `[db:...]`, `[usda:...]` or `[vision:...]` prefix.
- **Firebase Console → Realtime Database → Usage** — storage and bandwidth.
- **Firebase Console → Authentication → Users** — who has an account. Worth checking occasionally given there is no signup restriction.

---

## Backups

Realtime Database has no automatic backup on the free plan. Export manually:

**Realtime Database → ⋮ → Export JSON**, or:

```bash
firebase database:get / --output backup.json
```

For two users, an occasional manual export is proportionate. Note the export contains everyone's data in plaintext — store it accordingly.

---

## Rollback

**Vercel → Deployments**, find a previous working deployment and **Promote to Production**. Instant, no rebuild.

The database has no schema versioning, so a data-shape change is not undone by rolling back code. The normalisers in `lib/data/` are defensive precisely so old and new node shapes can coexist.

---

## Production checklist

- [ ] Email/Password sign-in enabled
- [ ] Realtime Database created; URL matches its region
- [ ] `database.rules.json` deployed (not test-mode defaults)
- [ ] `storage.rules` deployed, if Storage is enabled
- [ ] All environment variables set in Vercel
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` set, base64-encoded, **not** `NEXT_PUBLIC_`
- [ ] Vercel domain added to Firebase authorised domains
- [ ] `NEXT_PUBLIC_SITE_URL` matches the real domain
- [ ] Protected routes redirect when signed out
- [ ] API returns 401 when signed out
- [ ] `/api/auth/session` rejects a bogus token with 401
- [ ] App installs from Chrome and launches standalone
- [ ] Scan → confirm → log works end to end
- [ ] Food cache seeded (`node scripts/seed-food-cache.mjs`)
