# Database

Firebase Realtime Database — a single JSON tree, not tables. Security Rules live in `database.rules.json`.

---

## The shape of the tree

```
/
├── profiles
│     └── {uid}                       ← one node per user
│
├── food_logs
│     └── {uid}
│           └── {pushId}              ← one node per logged food
│
├── diet_plans
│     └── {uid}
│           └── {pushId}
│
├── diet_plan_meals
│     └── {uid}
│           └── {pushId}              ← carries plan_id
│
├── weight_entries
│     └── {uid}
│           └── {YYYY-MM-DD}          ← date IS the key
│
├── journal_entries
│     └── {uid}
│           └── {YYYY-MM-DD}          ← date IS the key
│
└── food_cache
      └── {normalised_query}          ← shared, no owner
```

## Why everything nests under `{uid}`

This is the central design decision, and it earns its keep three times over:

1. **Security rules become trivial.** One `auth.uid === $uid` check per subtree, instead of per-record ownership logic.
2. **Cross-user reads are structurally impossible.** There is no shared index to filter — a query is scoped by its path before any rule is evaluated. Forgetting a `where user_id ==` clause is not a mistake you can make.
3. **Queries stay cheap.** Realtime Database allows only one `orderByChild` per query and has no composite indexes. Nesting removes the need for the user dimension entirely, so the one available ordering can be spent on something useful like `log_date`.

The cost is that cross-user queries are impossible. For a private app with two users, that is not a cost.

---

## `profiles/{uid}`

The node key is the Firebase Auth uid, so a user has exactly one profile by construction.

| Field | Type | Notes |
|---|---|---|
| `full_name` | string | |
| `age` | number | 13–120, enforced by rules |
| `gender` | string | `male` \| `female` \| `other` |
| `height_cm` | number | 80–260 |
| `weight_kg` | number | 25–400 |
| `target_weight_kg` | number \| null | 25–400 |
| `activity_level` | string | `sedentary` \| `lightly_active` \| `moderately_active` \| `very_active` |
| `goal` | string | `lose_weight` \| `maintain_weight` \| `gain_weight` |
| `dietary_preference` | string | `vegetarian` \| `non_vegetarian` \| `vegan` \| `eggetarian` |
| `allergies` | string[] | Lowercased, de-duplicated by the app |
| `food_preferences` | string[] | |
| `meals_per_day` | number | 2–6 |
| `onboarded` | boolean | Gates access to the rest of the app |
| `created_at` / `updated_at` | number | Epoch ms via `ServerValue.TIMESTAMP` |

Postgres enums are gone, so the equivalent constraint is a `.validate` regex in the rules — see below. Ranges are validated in both Zod and the rules: Zod for a good error message, rules for the guarantee.

**This is the one node stored unencrypted**, and that is why. Rules cannot inspect ciphertext, so encrypting the profile would trade every guarantee in the table above for confidentiality of a name and a height. Everything a user actually records — what they ate, what they weigh, what they are working towards — is encrypted. See [Encryption at rest](#encryption-at-rest).

**Targets are not stored.** BMR, TDEE, calories and macros are derived from this node on every read by `lib/calculations/targets.ts`. Editing your weight changes your targets immediately, with no migration or recalculation job.

---

## `food_logs/{uid}/{pushId}`

One node per logged food item. A meal is several nodes sharing a `log_date` and `meal_type`.

| Field | Type | Notes |
|---|---|---|
| `log_date` | string | `YYYY-MM-DD`, regex-validated |
| `meal_type` | string | `breakfast` \| `lunch` \| `snack` \| `dinner` \| `other` |
| `food_name` | string | 1–120 chars |
| `quantity` | number | Default 1 |
| `grams` | number | 0 < g ≤ 5000 |
| `calories` | number | ≥ 0 |
| `protein_g` / `carbs_g` / `fat_g` | number | ≥ 0 |
| `image_url` | string \| null | Firebase Storage download URL |
| `nutrition_source` | string | `usda` \| `manual` \| `cache` \| `estimate` |
| `fdc_id` | string \| null | USDA FoodData Central id |
| `confidence` | number \| null | Model confidence 0–1 |
| `created_at` / `updated_at` | number | Epoch ms |

The table above is the *logical* record — what the app reads and writes. Physically, only `log_date`, `created_at` and `updated_at` are stored as-is; every other field lives inside the encrypted `enc` blob. See [Encryption at rest](#encryption-at-rest).

**Indexed on `log_date`** (`.indexOn: ["log_date"]`). Without that declaration Firebase still returns correct results but sorts on the client and logs a performance warning. It is also why `log_date` cannot be encrypted: the query is a range scan.

Keys come from `push()`, which generates chronologically-sortable ids.

There is no `user_id` field — it is implied by the path. The `FoodLog` type still carries one, populated from the path when reading.

**Absolute values are stored, not per-100 g values.** A log entry is a historical record: if USDA revises its data for chicken breast, what you ate last Tuesday should not change.

---

## `diet_plans/{uid}/{pushId}` and `diet_plan_meals/{uid}/{pushId}`

| `diet_plans` field | Type |
|---|---|
| `name` | string |
| `start_date` | string (`YYYY-MM-DD`) |
| `calorie_target` | number |
| `protein_target_g` / `carbs_target_g` / `fat_target_g` | number |
| `generator` | string — which provider built it |
| `is_active` | boolean — only one active plan per user |
| `created_at` / `updated_at` | number |

| `diet_plan_meals` field | Type |
|---|---|
| `plan_id` | string — the parent plan's push id |
| `day_index` | number 0–6 |
| `meal_type` | string |
| `name` | string |
| `foods` | array of `{ name, grams, calories, protein_g, carbs_g, fat_g }` |
| `calories` … `fat_g` | number — totals, recomputed server-side from `foods` |
| `sort_order` | number — position within the day |

Indexed on `plan_id`.

Both tables are the *logical* record. On disk, a plan keeps only `is_active` and its timestamps in the clear, a meal keeps only `plan_id` and its timestamps; the rest is sealed in `enc`. See [Encryption at rest](#encryption-at-rest).

Meals are a **sibling** of plans rather than nested inside them. Realtime Database fetches an entire subtree, so nesting 28 meals under a plan would mean downloading every meal just to read the plan's calorie target. Keeping them separate lets each be read independently.

Targets are snapshotted onto the plan, so a plan generated last week still shows the targets it was built for.

---

## `weight_entries/{uid}/{YYYY-MM-DD}`

| Field | Type | Notes |
|---|---|---|
| `entry_date` | string | Same as the key; stored for convenience |
| `weight_kg` | number | 25–400 |
| `note` | string \| null | ≤ 200 chars |
| `created_at` / `updated_at` | number | |

**The date is the key.** This is how the old `unique (user_id, entry_date)` constraint survives the move: writing twice for the same day overwrites rather than duplicating, so the trend chart can never show two points for one day. No index is needed either — `YYYY-MM-DD` keys sort chronologically on their own.

`weight_kg` and `note` are stored inside `enc`; the key, `entry_date` and the timestamps stay in the clear. Encrypting `entry_date` would gain nothing, since the key already is the date. See [Encryption at rest](#encryption-at-rest).

Changing an entry's date means *moving the node*. `PATCH /api/progress/[id]` does that as a single atomic multi-path update (`{ [newDate]: {...}, [oldDate]: null }`) — and because the ciphertext is bound to its record id, the move re-seals the record under the new date rather than copying the blob.

---

## `journal_entries/{uid}/{YYYY-MM-DD}`

| Field | Type | Notes |
|---|---|---|
| `entry_date` | string | Same as the key; stored for convenience |
| `mood` | string \| null | One of `great`, `good`, `okay`, `low`, `rough` |
| `content` | string | Free text, ≤ 5000 chars |
| `went_well` | string \| null | Daily review, ≤ 1000 chars |
| `went_wrong` | string \| null | Daily review, ≤ 1000 chars |
| `to_improve` | string \| null | Daily review, ≤ 1000 chars |
| `created_at` / `updated_at` | number | |

Same shape as `weight_entries`, and for the same reason: **the date is the key**, so a day has exactly one entry and re-saving edits it instead of stacking a second one. Entries sort chronologically without an index.

The free text and the three-part review share one node per day: the Journal and Daily review tabs are two ways of writing the same record, which is why a review-only day still counts once towards the streak. A day must carry *something* — free text or at least one review section — or the write is rejected.

Everything except the date is sealed inside `enc` — free text about how someone's day went is the most sensitive thing the app stores, so nothing about it beyond *that a day was written* is visible in the database. `PATCH /api/journal/[id]` re-dates an entry with the same atomic move-and-reseal the weigh-in route uses.

The `enc` size cap is 32 KB here rather than 4 KB: 5000 characters of free text plus three 1000-character review sections, in multi-byte script and then base64, does not fit in the smaller budget.

---

## `food_cache/{key}`

Shared, non-user-owned cache of normalized USDA lookups. Readable and writable by any signed-in user — it is public reference data with nothing private in it, which is also why it is left unencrypted: there is nothing to protect, and per-user keys would defeat the point of a shared cache.

| Field | Type |
|---|---|
| `query_key` | string — the original normalized query |
| `fdc_id` | string \| null |
| `name` | string |
| `brand` | string \| null |
| `calories_per_100g` … `fat_per_100g` | number |
| `source` | `usda` \| `seed` |
| `hit_count` | number — incremented atomically with `ServerValue.increment` |
| `created_at` / `updated_at` | number |

The key is the normalized query, further escaped because Realtime Database forbids `. $ # [ ] /` and spaces in keys:

```
"  Chicken  Breast! "   →  "chicken breast"  →  "chicken_breast"
```

That escaping lives in `encodeKey()` in `lib/firebase/admin.ts`, and the seed script duplicates it deliberately so it can run standalone.

**Fallback search is a full scan.** Realtime Database has no `contains` operator, so when USDA is unreachable the app reads the cache node and filters in memory. That is acceptable because the cache is small by design and the path only runs after USDA has already failed.

Seed it with `node scripts/seed-food-cache.mjs` (~40 common foods, including South Asian staples the recognition model does not know).

---

## Encryption at rest

Firebase encrypts its own disks, but that key is Google's: anyone who can read the database — through the Console, a leaked service-account key, an over-broad rule — sees plaintext. So user content is encrypted by the application *before* it is written, with a key that lives only in the app's environment. A database dump on its own is inert.

`lib/crypto/field-crypto.ts` holds the AES-256-GCM primitive; `lib/crypto/record-crypto.ts` decides what gets sealed.

**Every content field of a record is folded into one blob** under an `enc` key. A whole-record blob rather than per-field ciphertext, because it hides which optional fields are even present (an empty `note` and a long one look the same) and costs one GCM operation per record instead of a dozen.

What stays readable is only what the database itself has to understand:

| Node | Plaintext | Encrypted |
|---|---|---|
| `profiles/{uid}` | **everything** | nothing |
| `food_logs/{uid}/{pushId}` | `log_date`, `created_at`, `updated_at` | food name, portion, macros, image URL, confidence, source |
| `diet_plans/{uid}/{pushId}` | `is_active`, `created_at`, `updated_at` | name, start date, calorie and macro targets, generator |
| `diet_plan_meals/{uid}/{pushId}` | `plan_id`, `created_at`, `updated_at` | name, foods, macros, day index, meal type, sort order |
| `weight_entries/{uid}/{date}` | `entry_date`, `created_at`, `updated_at` | weight, note |
| `journal_entries/{uid}/{date}` | `entry_date`, `created_at`, `updated_at` | mood, entry text, all three review sections |
| `food_cache/{key}` | **everything** | nothing |

The exclusions are deliberate, not oversights:

- **`profiles` is not encrypted.** It is the one node whose fields the Security Rules genuinely validate — age 13–120, weight 25–400, the gender and goal enums. Rules cannot inspect ciphertext, so encrypting the profile would trade real server-side validation for confidentiality of a name and a height.
- **`log_date` cannot be encrypted.** History is read with `orderByChild('log_date').startAt(...)` — a range query. Deterministic encryption would support `equalTo` but not ordering, and order-preserving encryption leaks more than it hides.
- **`plan_id` and `is_active`** are an opaque push id and a boolean. They are indexed, and they reveal nothing.
- **`food_cache` is shared reference data** — USDA nutrition figures, owned by no user. There is nothing private in it, and per-user keys would defeat the point of a shared cache.

What this leaks, therefore, is *that* a user logged something on a given day — not what, how much, or what they weigh.

### Records are bound to their location

The ciphertext is authenticated with `"{collection}:{uid}:{recordId}"` as GCM additional data. That binding means a blob copied into another user's subtree, another collection, or another key simply fails to decrypt — someone with write access cannot graft another account's record onto their own and have the app read it back. It is also why moving a weigh-in to a different date (`PATCH /api/progress/[id]`) re-seals the record instead of copying the blob across.

### Reading and writing

Decryption happens inside the existing `normalize*` functions in `lib/data/`, so every read path gets plaintext without knowing encryption exists. Reads use `decryptRecordSafe`, which logs and degrades a single unreadable record to its plaintext fields rather than failing a whole page.

Writes are the one place that changed shape: a sealed record cannot be patched field-by-field, so partial updates are read-modify-write via `mergeEncryptedRecord`, finishing with `set` rather than `update`. Every route already read the node to check it existed, so this costs no extra round trip. Using `update` here would be a bug — it would leave a stale plaintext field beside the new blob.

### Legacy and rotation

A record with no `enc` key is treated as legacy plaintext and returned as-is, so encrypted and unencrypted data coexist and there is no cutover. `npm run encrypt:migrate` (`--dry-run` to preview) converts what already exists; it skips anything already sealed, so it is safe to re-run and resumes after an interruption.

Each blob carries the id of the key that sealed it (`v1.<keyId>.<iv>.<payload>`), derived from the key itself. To rotate: move the old key into `DATA_ENCRYPTION_KEYS_PREVIOUS`, put a new one in `DATA_ENCRYPTION_KEY`, deploy. Old records keep opening; new writes use the new key.

> **Back the key up separately from the database.** There is no recovery path — without `DATA_ENCRYPTION_KEY` the data is gone, and a backup of the database stored next to a backup of the key protects against nothing.

---

## Security Rules

`database.rules.json`. The root denies everything, and access is granted per subtree.

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "food_logs": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        ".indexOn": ["log_date"]
      }
    }
  }
}
```

Three things worth knowing about how these behave:

- **Rules are not filters.** A read is allowed or denied for the whole node; there is no row-level filtering the way RLS did it. That is precisely why the data is nested per user — the path does the scoping that a filter would otherwise have to.
- **Rules cascade downward and cannot be revoked.** Granting `.read` at `food_logs/$uid` grants it to everything beneath. A deeper `.read: false` does *not* take it away.
- **`.validate` runs only on non-null writes.** It cannot prevent a delete; `.write` governs that.

Validation in the rules covers what the app cannot be trusted to enforce alone — but only where the rules can still see the values. On `profiles`, that is the full set: date formats, enum values, and numeric ranges on age, height and weight.

On the encrypted nodes it necessarily shrinks. Rules cannot inspect ciphertext, so they now check the shape rather than the contents: the queryable field is present and well-formed, `enc` is a `v1.` string within a size cap, and `$other` rejects any key outside that set — so nothing can be written back in the clear. The field-level range checks that used to live here (grams 0–5000, confidence 0–1, weight 25–400) are enforced by the Zod schemas in `lib/validations/` before the record is sealed. That is a real reduction in defence-in-depth, and it is the price of encryption; it is tolerable here because these nodes are written exclusively by server routes through the Admin SDK, which bypassed the rules anyway. The only direct browser access is photo upload to Storage.

### The Admin SDK bypasses all of this

Every server-side read and write goes through `firebase-admin`, which ignores Security Rules entirely. On the server, **the path built from the verified session uid is the access control**. The rules protect the one path that reaches the database directly from the browser — and act as a backstop if server code ever gets a path wrong.

### Storage rules

`storage.rules`. Objects live at `food-images/{uid}/{file}`, and the rules compare that segment to `request.auth.uid`, cap uploads at 8 MB, and restrict content types to JPEG/PNG/WebP. Everything outside `food-images/` is denied.

---

## Deploying rules

```bash
npm install -g firebase-tools
firebase login
firebase use diet-app-64032

firebase deploy --only database        # database.rules.json
firebase deploy --only storage         # storage.rules
```

Or paste them into the Firebase Console: **Realtime Database → Rules**, and **Storage → Rules**.

> Deploy the rules before using the app in earnest. A database created in **test mode** is world-readable and its open rules expire after 30 days, at which point everything silently starts failing.

---

## What changed from the SQL version

Useful if you are reading git history, or considering moving back.

| Postgres | Realtime Database |
|---|---|
| Tables with typed columns | JSON tree, four value types |
| `uuid` primary keys | `push()` keys, or a natural key like the date |
| Enums | `.validate` regex in rules |
| `CHECK` constraints | `.validate` expressions |
| `UNIQUE (user_id, date)` | The date used as the node key |
| Foreign keys + `ON DELETE CASCADE` | Nothing. Orphans must be cleaned up explicitly — the plan generator deletes superseded plans' meals in the same atomic update |
| Row Level Security | Path nesting + Security Rules |
| `updated_at` trigger | Set explicitly on every write |
| `ORDER BY a, b` | One `orderByChild` per query; secondary sorts happen in memory |
| `ILIKE '%term%'` | Read the node and filter in memory |
| Transactions | Multi-path `update()`, atomic across arbitrary paths |
| Migrations | None. Schema is enforced by rules and by the normalisers in `lib/data/` |

The last row matters most in practice: **there are no migrations**, so old nodes keep their old shape indefinitely. That is why every reader in `lib/data/` coerces defensively through `lib/firebase/converters.ts` rather than trusting what it finds.
