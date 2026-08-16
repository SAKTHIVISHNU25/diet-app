# Nutrition

How nutrition data is fetched, normalized and turned into the numbers on your dashboard.

---

## USDA FoodData Central

[FoodData Central](https://fdc.nal.usda.gov/) is the USDA's public food composition database. It is free, requires only an email-issued API key, and is the reference source for most nutrition tooling.

```
lib/usda/
  client.ts     HTTP client, timeout, typed UsdaError
  types.ts      response types + nutrient numbers
  nutrition.ts  normalisation to the internal per-100 g shape
  search.ts     cache -> USDA -> cache fallback, plus ranking
```

### Client

- Base URL `https://api.nal.usda.gov/fdc/v1`
- 10-second timeout via `AbortController`
- The key is sent as an **`X-Api-Key` header, never in the URL**, so it cannot end up in logs or in an error message that echoes the request
- Responses are cached at the edge for 24 hours (`next: { revalidate: 86400 }`) — USDA reference data is effectively static
- Failures raise a typed `UsdaError` with kind `not_configured` / `unavailable` / `timeout` / `rate_limited`

Upstream response bodies are never included in thrown errors.

### Data types

Search requests these types, in preference order:

| Type | What it is |
|---|---|
| `Foundation` | Lab-analysed whole foods. Highest quality. |
| `SR Legacy` | The historical Standard Reference database. Broad and reliable. |
| `Survey (FNDDS)` | Prepared dishes as consumed in dietary surveys. |
| `Branded` | Manufacturer-submitted label data. Huge, noisy, least curated. |

---

## Normalisation

Every source is reduced to one internal shape:

```ts
interface FoodItem {
  fdcId?: string;
  name: string;
  brand?: string;
  source: 'usda' | 'manual' | 'cache' | 'estimate';
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams?: number;
  servingSizeLabel?: string;
}
```

### Nutrient identification

Nutrients are matched by **number**, never by name — names vary between data types.

| Nutrient | Number |
|---|---|
| Energy (kcal) | 208 |
| Energy, Atwater general | 957 |
| Energy, Atwater specific | 958 |
| Protein | 203 |
| Total lipid (fat) | 204 |
| Carbohydrate, by difference | 205 |

Three quirks are handled explicitly:

1. **Two response shapes.** Search returns `{ nutrientNumber, value }`; the food-detail endpoint returns `{ nutrient: { number }, amount }`. Both are read.
2. **Zero-padded numbers.** Some records use `"0208"` instead of `"208"`. Leading zeros are stripped before comparison.
3. **Energy fallbacks.** kcal is preferred; then the Atwater variants (some Foundation foods carry only these); finally kJ, converted at 1 kcal = 4.184 kJ.

A food with no usable macros at all is filtered out — it cannot be tracked.

### Per-100 g is the invariant

All requested data types report `foodNutrients` per 100 g, including Branded (whose per-serving values live in `labelNutrients`, which this app does not use). So no unit conversion is needed at normalisation time, and every downstream calculation can assume per-100 g.

### Descriptions

USDA descriptions are upper-case and comma-inverted:

```
CHICKEN, BROILERS OR FRYERS, BREAST, MEAT ONLY, RAW
  -> Chicken, Broilers or Fryers, Breast, Meat Only, Raw
```

Title-casing is applied only when the original is entirely upper-case, so already-readable descriptions are left alone. Minor words (`and`, `or`, `with`, `of`, …) stay lowercase inside the phrase. The qualifiers are kept — "raw" versus "cooked" changes the numbers materially.

---

## Ranking

USDA relevance alone tends to surface branded products ahead of the plain food — searching "chicken breast" can return a frozen dinner kit first. `rankResults()` re-scores:

| Signal | Weight |
|---|---|
| Data type | Foundation highest → Branded lowest |
| Exact description match | +50 |
| Description starts with the query | +25 |
| Each query word present | +5 |
| Description length | −1 per word (capped at −20) |

The length penalty matters more than it looks: shorter descriptions are usually the plain ingredient rather than a composite prepared dish, which is the better default for portion-based tracking.

---

## Caching

`food_cache` is a plain node in Realtime Database — no Redis, no extra service.

```
searchFood(query)
  │
  ├─ 1. exact hit on the normalized query key?      -> return it (no network)
  │
  ├─ 2. USDA configured?  -> call the API
  │        └─ cache the best result under the query key
  │
  └─ 3. USDA failed?      -> in-memory substring scan of the cache
                              (degraded: true)
```

The cache key is the normalized query — lowercased, punctuation stripped, whitespace collapsed:

```
"  Chicken  Breast! "     -> "chicken breast"
"Yogurt (Greek), plain"   -> "yogurt greek plain"
```

`hit_count` is incremented on read, as a best-effort write that never blocks the lookup.

A cache miss is never an error. Writes are best-effort: a failed cache write logs a warning and the request still succeeds.

`scripts/seed-food-cache.mjs` pre-populates roughly 40 common foods (including South Asian staples absent from Food-101), so the app is useful before any USDA call and stays useful if the API is down.

---

## Portion calculation

Scaling is linear from the per-100 g values:

```ts
const factor = grams / 100;

calories  = round(caloriesPer100g * factor)   // whole numbers
protein_g = round1(proteinPer100g * factor)   // one decimal
carbs_g   = round1(carbsPer100g   * factor)
fat_g     = round1(fatPer100g     * factor)
```

| Portion | Chicken breast (165 kcal/100 g) |
|---|---|
| 100 g | 165 kcal |
| 200 g | 330 kcal |
| 50 g | 83 kcal |
| 175 g | 289 kcal |

Calories are rounded to whole numbers because sub-calorie precision is meaningless against the accuracy of the inputs. A negative portion is treated as zero rather than producing negative food.

### What is stored

Food log rows store **absolute values**, not per-100 g values. A log entry is a historical record: if USDA revises its data for chicken breast next year, what you ate last Tuesday should not silently change.

When you edit a portion afterwards, the client rescales from the entry's own stored values:

```ts
const factor = newGrams / originalGrams;
calories = round(originalCalories * factor);
```

No second lookup, and no risk of the numbers drifting away from what was originally recorded.

---

## Day totals

`sumNutrition()` adds the day's entries, coercing defensively — the database is schemaless, so an unexpected string or an unparseable value contributes 0 rather than poisoning the total with `NaN`.

```ts
remaining = target − consumed              // may be negative
percent   = clamp(consumed / target, 0, 100)   // for progress bars
rawPercent = consumed / target                 // uncapped, for "142% of target"
```

Both percentages exist on purpose: a progress bar should not overflow its track, but the user should still see that they are at 142%.

---

## Fallback behaviour

| Situation | What happens |
|---|---|
| `USDA_API_KEY` unset | Search uses the local cache only and returns `degraded: true`; the UI says values can be entered manually |
| USDA unreachable / timeout | Fuzzy cache fallback; if that is empty, `provider_unavailable` |
| USDA rate limited (429) | `rate_limited` — "The nutrition service is busy. Please try again shortly." |
| No results for the query | `no_results` — "No nutrition data found for X. You can enter the values manually." |
| Recognition worked, nutrition did not | Candidate is returned with `needsNutrition: true`; the review screen shows a warning and blocks saving that item until nutrition is supplied |

At no point does a nutrition failure prevent logging food. Manual entry is always available.

---

## Accuracy

Worth being clear about, because the numbers look precise:

- **USDA values are representative, not exact.** They describe a typical sample of a generic food, not the specific thing on your plate. Preparation, cut, fat trimming, oil absorbed during cooking and brand all move the numbers.
- **Cooked versus raw matters a lot.** 100 g of raw chicken is not 100 g of cooked chicken — cooking removes water and concentrates everything per gram. USDA has separate entries; picking the wrong one is a common source of error.
- **"Carbohydrate, by difference"** is computed as what remains after water, protein, fat and ash — so it inherits the error of all four, and includes fibre.
- **Composite dishes vary enormously.** "Chicken curry" spans a wide range depending on cream, oil and portion.
- **Portion is the dominant error term.** Being 30% wrong on portion swamps any difference between two reasonable USDA entries. This is why the portion field is the most prominent editable control on the review screen.

Treat the totals as a consistent relative signal — useful for spotting trends and comparing days — rather than as an exact measurement.

> Nutrition and calorie values are estimates and should not be considered medical advice. Consult a qualified healthcare professional for medical or dietary conditions.
