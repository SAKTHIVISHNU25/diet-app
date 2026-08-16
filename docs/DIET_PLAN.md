# Diet plan and targets

How Diet AI turns a profile into daily targets, and those targets into a 7-day meal plan.

---

## The calculation chain

```
profile  ->  BMR  ->  TDEE  ->  calorie target  ->  macro targets
```

All of it lives in `lib/calculations/` as pure functions — no I/O, no framework imports — so the dashboard, the planner and the tests cannot disagree.

Targets are **not stored in the database**. They are derived on every read, so changing your weight or activity level updates them instantly with no recalculation job.

---

## BMR — Mifflin-St Jeor

Basal Metabolic Rate: the energy your body uses at complete rest.

```
men:    10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
women:  10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
```

> Mifflin MD, St Jeor ST, et al. *A new predictive equation for resting energy expenditure in healthy individuals.* Am J Clin Nutr. 1990;51(2):241-247.

Mifflin-St Jeor is used rather than Harris-Benedict because it is more accurate for contemporary populations, and rather than Katch-McArdle because that needs a body fat percentage most people do not know.

**Non-binary users.** The equation has no validated variant beyond the two sex constants. For `other`, the midpoint (−78) is used. This is an approximation chosen so nobody has to misreport themselves to use the app; the result is an estimate either way.

Worked example — 30-year-old man, 80 kg, 180 cm:

```
10(80) + 6.25(180) − 5(30) + 5
= 800 + 1125 − 150 + 5
= 1780 kcal/day
```

---

## TDEE

Total Daily Energy Expenditure: BMR scaled by how much you move.

| Activity level | Multiplier | Description |
|---|---|---|
| Sedentary | 1.2 | Desk job, little or no exercise |
| Lightly active | 1.375 | Light exercise 1–3 days a week |
| Moderately active | 1.55 | Moderate exercise 3–5 days a week |
| Very active | 1.725 | Hard exercise 6–7 days a week |

```
TDEE = BMR × multiplier
```

1780 × 1.55 = **2759 kcal/day**.

People routinely overestimate their activity level. If your weight is not moving as expected, dropping a level is usually closer to the truth than distrusting the arithmetic.

---

## Calorie target

```
target = TDEE + adjustment
```

| Goal | Adjustment | Rationale |
|---|---|---|
| Lose weight | −500 kcal | ≈ 0.5 kg/week, using ~7700 kcal ≈ 1 kg of body fat |
| Maintain weight | 0 | |
| Gain weight | +350 kcal | A modest surplus favours lean mass over fat |

### Safety floor

```ts
const floor = Math.min(gender === 'male' ? 1500 : 1200, tdee);
return Math.max(adjusted, floor);
```

A −500 deficit applied to a small person can produce a dangerously low target. The floor prevents that: 1200 kcal for women and `other`, 1500 for men — the commonly cited minimums for unsupervised dieting.

The `Math.min(..., tdee)` matters. Without it, a user whose TDEE is genuinely below the floor would be pushed into a *surplus* by a safety mechanism meant to protect them.

The 7700 kcal/kg figure is a population-level approximation. Real weight change is noisier — water, glycogen and adaptive changes in expenditure all interfere over short periods.

---

## Macro targets

Order of operations, chosen so the macro with the strongest evidence anchors the split:

### 1. Protein — from bodyweight

| Goal | g/kg |
|---|---|
| Lose weight | 1.8 |
| Maintain weight | 1.6 |
| Gain weight | 1.8 |

Higher protein while cutting helps preserve lean mass. These sit inside the 1.2–2.2 g/kg range generally cited for active adults (Jäger et al., ISSN position stand, 2017).

### 2. Fat — a share of calories, with a floor

```
fat_g = max(0.5 × weightKg, (calorieTarget × 0.27) / 9)
```

27% of calories, but never below 0.5 g/kg. The floor protects essential fatty acid intake and absorption of fat-soluble vitamins.

### 3. Carbohydrate — the remainder

```
carb_calories = calorieTarget − protein_calories − fat_calories
```

Carbs are the flexible macro. Energy factors are the Atwater values: protein 4, carbs 4, fat 9 kcal/g.

### Reconciliation

For a heavy person on an aggressive deficit, protein plus fat alone can exceed the entire calorie target. Rather than emitting negative carbs, the calculation reserves 10% of calories for carbohydrate and scales protein and fat down proportionally to fit:

```ts
if (proteinCals + fatCals + carbFloorCals > calorieTarget) {
  const scale = (calorieTarget - carbFloorCals) / (proteinCals + fatCals);
  protein_g *= scale;
  fat_g *= scale;
}
```

The three macros always reconcile to the calorie target, within a few calories of rounding. This is asserted in the test suite.

Worked example — 80 kg man, 2259 kcal target, losing weight:

```
protein = 1.8 × 80             = 144 g   (576 kcal)
fat     = max(40, 2259×0.27/9) = 68 g    (610 kcal)
carbs   = (2259 − 576 − 610)/4 = 268 g   (1073 kcal)
                                  ------
                                  2259 kcal ✓
```

---

## Meal planning

The planner is **deterministic, offline and free**. No AI API, no network, no key. Given the same profile and seed it always produces the same plan.

### Provider abstraction

```ts
interface DietPlanProvider {
  readonly name: string;
  generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan>;
}
```

Selected by `DIET_PLAN_PROVIDER`, defaulting to `template`. Any unrecognised value falls back to the template planner — a missing or misconfigured AI key must never make the diet plan feature unavailable.

### Food database

`lib/diet/food-database.ts` holds ~35 curated foods with per-100 g nutrition from USDA reference entries. Each carries:

```ts
{
  tag: 'protein' | 'carb' | 'vegetable' | 'fat' | 'fruit' | 'dairy',
  diets: DietaryPreference[],       // who may eat it
  baseGrams, minGrams, maxGrams,    // sensible portion bounds
  allergens: string[],              // matched against the user's list
  meals: ('breakfast'|'lunch'|'snack'|'dinner')[],
}
```

It deliberately includes South Asian staples (dal, roti, paneer, rajma, idli, poha) alongside Western ones, since the recognition model's dataset covers those poorly.

**Filtering** happens before any selection:

- Dietary preference must include the food.
- Allergens are matched **in both directions** on lowercased text — so a user allergy of `"nuts"` excludes a food tagged `"tree nuts"`, and vice versa.
- Disliked foods are excluded by name substring.

### Meal splits

| Meals/day | Distribution |
|---|---|
| 2 | Lunch 50%, Dinner 50% |
| 3 | Breakfast 30%, Lunch 40%, Dinner 30% |
| 4 | Breakfast 25%, Lunch 35%, Snack 10%, Dinner 30% |
| 5 | Breakfast 22%, Snack 10%, Lunch 31%, Snack 10%, Dinner 27% |
| 6 | Breakfast 20%, Snack 9%, Lunch 28%, Snack 9%, Dinner 25%, Snack 9% |

Each split sums to 100% — asserted in the tests.

### Building a meal

For each of 7 days × meals per day:

1. **Pick foods** — a protein, a carbohydrate and a vegetable, rotated by `day × 3 + slotIndex` plus a seeded jitter, so the week varies and the same food does not land on consecutive days. Foods matching the user's stated preferences are favoured.
2. **Size the protein** to hit the meal's protein target:
   `grams = (mealProteinTarget / proteinPer100g) × 100`
3. **Add vegetables** at their standard serving — volume, not calories. Skipped for snacks.
4. **Let the carbohydrate absorb the remaining calories:**
   `grams = (remainingCalories / caloriesPer100g) × 100`
5. **Top up with a fat source** if the meal is still more than 60 kcal short.
6. **Clamp every portion** to that food's min/max and round to the nearest 5 g.

### Why plans do not hit the target exactly

Step 6 is the reason. Portions are bounded so the planner never suggests 700 g of chicken or 5 g of rice. When a target would require a portion outside those bounds, the realistic portion wins and the meal lands short or over.

This is a deliberate trade: a plan you would actually eat beats one that hits a number. In testing, daily totals land within roughly ±20% of target for typical profiles; the test suite asserts they stay within 60–140%.

### Determinism

`seededRandom()` is a Lehmer generator (`state × 16807 mod 2^31−1`). Same seed, same plan — every time.

- **Generate without a seed:** a per-user, per-day seed is derived, so retrying on the same day is stable.
- **Regenerate:** the client sends a fresh random seed, guaranteeing something different.

---

## Editing and replacing

**Replace a meal** (`POST /api/diet-plan/meal/[id]/replace`) rebuilds one meal against the **same calorie and protein share** as the slot it occupies. The day's totals therefore stay near target rather than drifting with each swap. The seed is offset so the replacement differs from what was there.

**Edit a meal** (`PATCH /api/diet-plan/meal/[id]`) lets you rename it, rescale a food's portion, or remove a food. Changing a portion rescales that food's macros from its original values; the **server recomputes the meal totals from the submitted foods**, so the totals can never disagree with the food list.

**Regenerate** builds a whole new plan and deactivates the previous one. Only one plan is active at a time.

---

## Adding an AI planner later

The seam already exists. To add one:

1. Implement `DietPlanProvider`, returning the same `GeneratedPlan` shape.
2. Register it in `lib/diet/provider.ts`.
3. Set `DIET_PLAN_PROVIDER=<name>`.

Two things it should do:

- **Fall back to the template planner when its API call fails.** The feature must never become unavailable because a key expired.
- **Validate its output.** A model may return implausible portions or ignore an allergy. Run the result through the same allergen filter and portion bounds before persisting — an AI planner must not be able to put an allergen on a user's plate.

---

## Testing

`tests/calculations.test.ts` (21 tests) and `tests/diet-planner.test.ts` (24 tests) cover:

- BMR against hand-computed values from the published formula, for each gender.
- Activity multipliers being monotonic and in range.
- Goal adjustments, the safety floor, and the floor not creating a surplus.
- Macros reconciling to the calorie target within rounding.
- Carbs never going negative for a heavy user on a deep deficit.
- Meal splits summing to 100% for every supported meal count.
- Allergen filtering in both directions, and case/whitespace insensitivity.
- **Every meal of a whole week respecting vegan and allergy constraints.**
- Determinism for a seed, and difference across seeds.
- Meal totals equalling the sum of their foods.
- No absurd portions anywhere in a generated plan.

---

> Calorie and macro targets are estimates based on population-level equations. Individual metabolic rates vary considerably. These values are not medical advice — consult a qualified healthcare professional for medical or dietary conditions.
