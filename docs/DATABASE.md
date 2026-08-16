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

**Indexed on `log_date`** (`.indexOn: ["log_date"]`). Without that declaration Firebase still returns correct results but sorts on the client and logs a performance warning.

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

Changing an entry's date means *moving the node*. `PATCH /api/progress/[id]` does that as a single atomic multi-path update (`{ [newDate]: {...}, [oldDate]: null }`).

---

## `food_cache/{key}`

Shared, non-user-owned cache of normalized USDA lookups. Readable and writable by any signed-in user — it is public reference data with nothing private in it.

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

Validation in the rules covers what the app cannot be trusted to enforce alone: date formats, enum values, and numeric ranges on age, height, weight, grams and confidence.

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
