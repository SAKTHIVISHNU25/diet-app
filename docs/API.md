# API

All routes live under `/api` and are implemented as Next.js Route Handlers.

**Every route requires an authenticated session.** Identity comes from an httpOnly Firebase session cookie, verified server-side with `verifySessionCookie(cookie, true)` — which checks the signature *and* that the session has not been revoked. A `user_id` in a request body is ignored; every read and write path is built from the session's uid.

---

## Conventions

### Success

`2xx` with a JSON object. Shape varies per route and is documented below.

### Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Please check the highlighted fields.",
    "details": { "grams": "Portion must be greater than 0" }
  }
}
```

`details` appears only for validation failures, keyed by field name.

| Code | Status | Meaning |
|---|---|---|
| `unauthenticated` | 401 | No valid session |
| `forbidden` | 403 | Authenticated but not allowed |
| `not_found` | 404 | Record does not exist, or is not yours |
| `invalid_request` | 400 | Body or query failed validation |
| `invalid_image` | 400 | Not a readable JPEG/PNG/WebP |
| `image_too_large` | 413 | Over 8 MB |
| `provider_unavailable` | 503 | Vision or nutrition provider unreachable |
| `provider_timeout` | 504 | Provider did not respond in time |
| `no_results` | 404 | Search returned nothing usable |
| `missing_profile` | 409 | Action needs a completed profile |
| `not_configured` | 503 | A required API key is unset |
| `rate_limited` | 429 | Upstream quota exhausted |
| `database_error` | 500 | Realtime Database read or write failed |
| `internal_error` | 500 | Unexpected failure |

Error messages are always safe to display. Stack traces, upstream response bodies and API keys are logged server-side and never returned.

---

## `POST /api/food/analyze`

Recognise food in a photo and attach nutrition. **Logs nothing** — the client shows the result for confirmation.

**Request** — `multipart/form-data`

| Field | Type | Constraints |
|---|---|---|
| `image` | File | JPEG/PNG/WebP, ≤ 8 MB, verified by magic bytes |

**Response `200`**

```json
{
  "candidates": [
    {
      "id": "candidate-1755300000000",
      "name": "Chicken Curry",
      "grams": 200,
      "confidence": 0.82,
      "estimatedPortion": "about 1 serving",
      "nutrition": {
        "caloriesPer100g": 150,
        "proteinPer100g": 14,
        "carbsPer100g": 5,
        "fatPer100g": 8
      },
      "source": "usda",
      "fdcId": "171077",
      "needsNutrition": false
    }
  ],
  "alternatives": [
    { "name": "Pad Thai", "confidence": 0.09 }
  ],
  "confident": true,
  "notes": "Portion is a typical serving size, not measured from the photo. Adjust it if needed.",
  "provider": "huggingface",
  "model": "nateraw/food",
  "nutritionDegraded": false
}
```

**Behaviour worth knowing**

- When the top prediction is below the confidence threshold (0.4), `candidates` is **empty**, `confident` is `false`, and `alternatives` carries the model's guesses. The UI then asks the user to choose the food. A name the model is unsure of is never presented as an identification.
- `nutritionDegraded: true` means recognition worked but USDA did not. The candidate has `needsNutrition: true` and the user must supply nutrition before saving.
- `grams` is a **category default**, never measured from the image. See [FOOD_RECOGNITION.md](FOOD_RECOGNITION.md).

**Errors**: `unauthenticated`, `invalid_image`, `image_too_large`, `provider_unavailable`, `provider_timeout`, `rate_limited`, `not_configured`

---

## `GET /api/nutrition/search`

Search USDA FoodData Central for per-100 g nutrition.

**Query**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `q` | string | — | 2–80 characters |
| `limit` | number | 10 | 1–25 |

**Response `200`**

```json
{
  "items": [
    {
      "fdcId": "171077",
      "name": "Chicken, Broilers or Fryers, Breast, Meat Only, Raw",
      "source": "usda",
      "caloriesPer100g": 165,
      "proteinPer100g": 31,
      "carbsPer100g": 0,
      "fatPer100g": 3.6,
      "servingSizeGrams": 140
    }
  ],
  "source": "usda",
  "degraded": false
}
```

`source` is `usda` for a live lookup or `cache` for a local hit. `degraded: true` means USDA was unreachable and results came from the local cache.

Results are re-ranked before being returned — curated USDA data types are preferred over branded products, and closer description matches win. See [NUTRITION.md](NUTRITION.md).

**Errors**: `unauthenticated`, `invalid_request`, `no_results`, `provider_unavailable`, `provider_timeout`, `rate_limited`, `not_configured`

---

## `POST /api/food/log`

Create one or more food log entries.

**Request**

```json
{
  "items": [
    {
      "log_date": "2026-08-16",
      "meal_type": "lunch",
      "food_name": "Chicken Curry",
      "quantity": 1,
      "grams": 200,
      "calories": 300,
      "protein_g": 28,
      "carbs_g": 10,
      "fat_g": 16,
      "image_url": "https://firebasestorage.googleapis.com/v0/b/.../o/food-images%2F...",
      "nutrition_source": "usda",
      "fdc_id": "171077",
      "confidence": 0.82
    }
  ]
}
```

1–20 items. `meal_type` is one of `breakfast`, `lunch`, `snack`, `dinner`, `other`. `nutrition_source` is one of `usda`, `manual`, `cache`, `estimate`.

**Response `201`** — `{ "logs": [ /* the created entries */ ] }`

Written as one atomic multi-path update: either every item in the batch is stored, or none is.

**Errors**: `unauthenticated`, `invalid_request`, `database_error`

---

## `GET /api/food/log`

**Query**: `date` (optional, `YYYY-MM-DD`). Omit for all entries.

**Response `200`** — `{ "logs": [...] }`, oldest first.

---

## `PATCH /api/food/log/[id]`

Update one entry. All fields optional; at least one required.

**Request** — `{ "grams": 250, "calories": 375, "meal_type": "dinner" }`

**Response `200`** — `{ "log": { ... } }`

The client recomputes nutrition from the entry's own per-gram values when the portion changes, so the stored numbers stay internally consistent without another lookup.

**Errors**: `unauthenticated`, `invalid_request`, `not_found`, `database_error`

---

## `DELETE /api/food/log/[id]`

**Response `200`** — `{ "deleted": true }`

**Errors**: `unauthenticated`, `not_found`, `database_error`

---

## `GET /api/progress`

**Response `200`** — `{ "entries": [...] }`, oldest first.

---

## `POST /api/progress`

Record a weigh-in. The entry is stored at `weight_entries/{uid}/{entry_date}`, so **the date is the key** — saving twice for one date corrects it rather than creating a duplicate that would distort the trend chart.

**Request**

```json
{ "entry_date": "2026-08-16", "weight_kg": 72.4, "note": "After morning run" }
```

`weight_kg` must be 25–400. `note` is optional, ≤ 200 characters.

**Response `201`** — `{ "entry": { ... } }`

**Errors**: `unauthenticated`, `invalid_request`, `database_error`

---

## `PATCH /api/progress/[id]` · `DELETE /api/progress/[id]`

Update or delete a weigh-in. Responses are `{ "entry": {...} }` and `{ "deleted": true }`.

**`[id]` here is the date** (`YYYY-MM-DD`), because that is the node key. Changing `entry_date` therefore *moves* the node: the handler does it as a single atomic multi-path update, writing the new key and nulling the old one together.

**Errors**: `unauthenticated`, `invalid_request`, `not_found`, `database_error`

---

## `GET /api/journal`

**Response `200`** — `{ "entries": [...] }`, newest first.

---

## `POST /api/journal`

Write a day's journal entry. Stored at `journal_entries/{uid}/{entry_date}`, so **the date is the key** — saving twice for one date rewrites that day rather than creating a second entry.

**Request**

```json
{
  "entry_date": "2026-08-16",
  "mood": "good",
  "content": "Stayed under target.",
  "went_well": "Hit my protein target.",
  "went_wrong": "Skipped lunch, over-ate at 9pm.",
  "to_improve": "Prep lunch the night before."
}
```

`content` is ≤ 5000 characters and each review section (`went_well`, `went_wrong`, `to_improve`) is ≤ 1000. All are optional individually, but **at least one must be non-empty** — a day with nothing written is rejected. `mood` is optional and must be one of `great`, `good`, `okay`, `low`, `rough` (or `null`).

**Response `201`** — `{ "entry": { ... } }`

**Errors**: `unauthenticated`, `invalid_request`, `database_error`

---

## `PATCH /api/journal/[id]` · `DELETE /api/journal/[id]`

Update or delete a journal entry. Responses are `{ "entry": {...} }` and `{ "deleted": true }`.

As with weigh-ins, **`[id]` is the date** (`YYYY-MM-DD`). Changing `entry_date` moves the node in one atomic multi-path update, re-sealing the record under the new key.

A PATCH carries only the fields being changed and does *not* apply the "at least one field" rule — that is what lets a review section be cleared back to `null` on an entry that still has free text.

**Errors**: `unauthenticated`, `invalid_request`, `not_found`, `database_error`

---

## `POST /api/diet-plan/generate`

Generate and persist a 7-day plan from the signed-in user's profile. Uses the template planner — **no AI API key required**.

**Request**

```json
{ "replaceActive": true, "seed": 12345 }
```

Both optional. `replaceActive` (default `true`) deactivates the previous plan. `seed` makes generation deterministic; omitted, it derives a per-user, per-day seed so a retry on the same day is stable while an explicit regenerate produces something new.

**Response `201`** — `{ "planId": "uuid", "mealCount": 28 }`

If meal insertion fails, the plan row is deleted so a plan with no meals is never left behind.

**Errors**: `unauthenticated`, `invalid_request`, `missing_profile`, `no_results` (allergies and dietary preference excluded everything), `database_error`

---

## `PATCH /api/diet-plan/meal/[id]`

Edit a planned meal.

**Request**

```json
{
  "name": "Chicken and rice",
  "foods": [
    { "name": "Grilled chicken breast", "grams": 150, "calories": 248,
      "protein_g": 46.5, "carbs_g": 0, "fat_g": 5.4 }
  ]
}
```

When `foods` is supplied the meal totals are **recomputed server-side** from it. The client cannot set totals that disagree with the food list.

**Response `200`** — `{ "meal": { ... } }`

**Errors**: `unauthenticated`, `invalid_request`, `not_found`, `database_error`

---

## `POST /api/diet-plan/meal/[id]/replace`

Swap a meal for a different one built against the **same calorie and protein share** as the slot it replaces, so the day's totals stay near target rather than drifting with each swap.

**Request** — `{ "seed": 12345 }` (optional)

**Response `200`** — `{ "meal": { ... } }`

**Errors**: `unauthenticated`, `not_found`, `missing_profile`, `no_results`, `database_error`

---

## `POST /api/auth/session`

The bridge between the browser-side Firebase Auth SDK and server-side rendering.

Firebase Auth has no server session of its own, so after signing in the client posts its ID token here and the server exchanges it for an httpOnly **session cookie** (valid 14 days, the Firebase maximum). Server Components and route handlers verify that cookie on every request — which is what lets pages render with real data instead of a client-side fetch waterfall.

**Request** — `{ "idToken": "eyJhbGci..." }`

**Response `200`** — `{ "uid": "..." }`, with `Set-Cookie: __session=...; HttpOnly; SameSite=Lax`

The token is verified with `verifyIdToken(token, true)` *before* a cookie is minted, so a forged or revoked token is rejected rather than converted into a valid session.

**Errors**: `invalid_request` (malformed body), `unauthenticated` (token failed verification)

---

## `DELETE /api/auth/session`

Sign out. Clears the cookie by setting it with `maxAge: 0`.

**Response `200`** — `{ "signedOut": true }`

The client also calls the Firebase SDK's own `signOut()`, because the SDK keeps a separately persisted session that would otherwise silently re-authenticate on the next page load.

---

## Non-API mutations

The profile form uses a Server Action rather than a route handler, because it is tied to a specific form and benefits from `useActionState` error handling:

| Action | File | Purpose |
|---|---|---|
| `saveProfile` | `app/(dashboard)/profile/actions.ts` | Create or update the profile |

Sign-in and sign-up are **not** Server Actions: Firebase Auth is a browser SDK, so those run client-side in `lib/firebase/auth-client.ts` and then call `POST /api/auth/session` to establish the server session.

They validate with the same Zod schemas and return field-level errors in the same shape as the API.

Sign-in failures are collapsed into a deliberately generic *"That email or password is not correct"* — distinguishing "no such user" from "wrong password" would let anyone enumerate which addresses have accounts. A genuine connection failure is reported separately, so a network outage is never misreported as a wrong password.

---

## Rate limiting

The app itself does not rate-limit; with two users there is nothing to protect against. Upstream limits still apply:

- **USDA**: 1,000 requests/hour per key. `food_cache` absorbs repeats, and exhaustion surfaces as `rate_limited`.
- **Hugging Face**: free-tier serverless quotas set by Hugging Face; exhaustion surfaces as `rate_limited`.

If this ever opened to more users, rate limiting on `/api/food/analyze` would be the first thing to add.
