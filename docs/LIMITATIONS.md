# Limitations

An honest account of what this app does not do well. Read this before trusting any number it shows you.

---

## Food image recognition

The largest source of error, by some distance.

### It recognises 101 foods, and only those

`nateraw/food` is a classifier trained on [Food-101](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/). It has exactly 101 output classes and **no "unknown" class**. Every image it sees is forced into its nearest class — a photo of your car will come back as a food, possibly with high confidence.

Food-101 is overwhelmingly Western restaurant and café food. Poorly covered or absent:

- Most South Asian home cooking — dal, roti, idli, dosa, poha, rajma, most paneer dishes
- Most East Asian home cooking beyond sushi, ramen and a few others
- Most African and Middle Eastern cuisine
- Plain single ingredients — an apple, a chicken breast, a bowl of rice
- Anything packaged or branded

If your diet sits outside that distribution, recognition will be wrong often. **Manual entry is a first-class path in this app for that reason** — it is not a fallback bolted on.

### It cannot see more than one food

This is a classifier, not an object detector. Given a plate of rice, curry and salad it returns a probability distribution over the same 101 classes for the whole image — one label, not three. The alternatives shown in the UI are *other guesses for the same item*, not additional foods.

Multiple foods must be added by hand with "Add another food". This is honest, not a workaround: pretending the model found three foods would be fabricating data.

### It cannot estimate portion size at all

There is no size, depth, volume or scale output. None. The grams shown come from a lookup table keyed on the food category:

```
pizza -> 125 g   soup -> 350 g   rice -> 250 g   default -> 200 g
```

The data records this explicitly (`portionSource: 'category_default'`) and the UI says so:

> Portion is a typical serving size, not measured from the photo. Adjust it if needed.

**If you accept the default without checking, your log will be wrong** whenever your portion differs from typical — which is most of the time. Portion error dwarfs every other inaccuracy in this app.

### Confidence scores are not reliability scores

The threshold (0.4) filters obviously uncertain predictions. It cannot catch confidently-wrong ones, and out-of-distribution images are exactly where a softmax over 101 fixed classes is most likely to be confidently wrong.

This is why confirmation is mandatory rather than advisory.

### Image quality matters

Poor lighting, steep angles, partial occlusion, dishes still in packaging, and very mixed plates all degrade accuracy sharply. The model was trained on reasonably composed food photography.

---

## Portion estimation

Covered above, but it deserves its own heading because it is the single biggest driver of error in your daily totals.

Every gram figure is a category default, a vision model's visual guess, or something you typed. Doing this properly requires either a fiducial reference in frame (a known-size object), depth data, or a model trained specifically on volume estimation — none of which are present.

### Model portion guesses are bounded, not corrected

The VLM does return a weight, but it has no scale reference and is regularly out by a factor of two or three. Because every macro is `grams x per-100 g density`, one overestimate inflates protein, carbs, fat and calories together — a plain dosa read as 350 g reports roughly three dosas' worth of protein with nothing on screen saying so.

`clampPortion()` in `lib/vision/portions.ts` bounds the model's number to a plausible range for that food, scaled by the number of pieces it reported (one dosa: 50–160 g; three dosas: 150–480 g). When the guess is clamped, the review screen says *"adjusted to a realistic serving size"*.

This catches gross errors only. A clamped portion is still a guess, and the bound cannot tell a large dosa from a small one.

A 30% portion error is far larger than any difference between two reasonable USDA entries for the same food. Weighing food, even occasionally, will improve your data more than any change to the recognition model.

---

## Nutrition data

### USDA values are representative, not exact

They describe a typical sample of a generic food, not the specific thing on your plate. Cut, trim, brand, preparation and cooking oil all move the numbers.

### Cooked versus raw is a common trap

100 g of raw chicken is not 100 g of cooked chicken — cooking drives off water and concentrates everything per gram. USDA has separate entries. Picking the wrong one introduces a systematic error across every meal.

### "Carbohydrate, by difference"

USDA computes carbohydrate as what remains after water, protein, fat and ash. It therefore inherits the measurement error of all four, and it includes fibre.

### Composite dishes vary enormously

"Chicken curry" covers an enormous range depending on cream, oil and preparation. A single USDA entry cannot represent that spread.

### Coverage gaps

Regional and home-cooked dishes are thinly covered. Branded data is manufacturer-submitted and unverified. `scripts/seed-food-cache.mjs` pre-loads ~40 common foods (including South Asian staples) to partly compensate.

### The ranking heuristic is a heuristic

Results are re-ranked to favour curated data types and closer description matches. It usually surfaces the right food. Sometimes it does not — check what was matched before saving.

---

## Diet plans

### The planner is a template, not a nutritionist

It selects from a curated database of ~35 foods and scales portions arithmetically. It has no understanding of nutrition beyond calories and three macros. It does not consider micronutrients, fibre, medical conditions, medication interactions, food cost, cooking time, or what you actually have in the kitchen.

### Plans do not hit targets exactly

Portions are clamped to sensible bounds so the planner never suggests 700 g of chicken. When a target would require a portion outside those bounds, the realistic portion wins. Daily totals typically land within ±20% of target.

### Variety is limited

Seven days from ~35 foods, filtered by dietary preference and allergies, produces repetition. A vegan with nut and soy allergies will see very little variety, and may hit the "no suitable foods" error.

### Allergy filtering is substring matching

Matching is bidirectional on lowercased text, which handles "nuts" ↔ "tree nuts". It is not a curated allergen ontology. It will not know that a dish contains a derivative of something you listed.

**If you have a serious allergy, read every meal.** Do not rely on this filter. It is a convenience, not a safety system.

### Only three macros

Micronutrients, fibre, sodium, sugar and saturated fat are not tracked or planned for.

---

## Calorie and macro targets

### Predictive equations are population averages

Mifflin-St Jeor predicts resting expenditure within roughly ±10% for most people, and further off for some. Body composition, genetics, medication and thyroid function all shift real requirements.

### Activity multipliers are coarse

Four buckets cannot capture how people actually move. Most people overestimate their activity level. If your weight is not responding as expected, the multiplier is usually the culprit.

### The 7700 kcal per kg rule is an approximation

Real weight change is noisier — water, glycogen and adaptive changes in energy expenditure all interfere, particularly over short periods.

### Targets are not medical advice

They are arithmetic on population-level equations. If you have any medical condition, are pregnant or breastfeeding, have a history of disordered eating, or take medication that affects metabolism or appetite, talk to a qualified professional before following them.

---

## PWA and browser support

### The install prompt is Chromium-only

`beforeinstallprompt` is a non-standard, Chromium-only API. Firefox and Safari never fire it, so no in-page prompt can appear there. The app still works fully as a website and can be added to the home screen manually.

### iOS differs meaningfully

No install prompt. Home-screen app storage can be evicted after roughly seven days of non-use (this affects the local install-dismissal flag, not your data — that lives in Firebase). App shortcuts and maskable icons are ignored.

### Offline support is intentionally minimal

The service worker caches build assets and serves an offline page. It does **not** cache your data. Offline you cannot log food, look up nutrition, analyse photos, generate plans or record weight.

This is a deliberate choice. Caching private per-user data would risk showing one account's information to another on a shared device, and would present stale calorie totals as current. Offline write queueing would need conflict resolution and a local mirror of private data — disproportionate machinery, and a real privacy trade-off, for a two-user app.

### Reminders are local, not push

Profile → Notifications gives per-device meal, weigh-in and journal reminders, scheduled in the browser. Everything starts off; turning the master switch on requests permission and sends one confirmation notification, once ever. There is no push server, so a reminder only arrives while MyLyf is running (a tab, or the installed PWA). One missed by more than 45 minutes — the device was asleep, the app was closed — is skipped rather than delivered late.

Preferences are stored in `localStorage`, not on the account: notification permission is granted per browser, so a phone must be turned on separately from a laptop. Real push would need a service worker subscription, VAPID keys and a scheduler running server-side — disproportionate for a two-user app.

---

## Application scope

### Built for a small number of users

No rate limiting, no abuse prevention, no per-tenant quotas. Fine for two people; it would need work before opening up.

### No invite system

Anyone with the URL can sign up. Firebase offers no one-click way to disable Email/Password signup, so restricting it needs either manual account deletion or a small allowlist check — see [DEPLOYMENT.md](DEPLOYMENT.md).

### No data export or account deletion UI

Data can be exported from the Firebase Console. There is no in-app button for either.

**Deleting a user does not delete their data.** Realtime Database has no foreign keys and no cascade, so removing an account in Firebase Auth leaves `profiles/{uid}`, `food_logs/{uid}` and the rest orphaned. They must be deleted by hand.

### No schema migrations

Realtime Database is schemaless, so nodes written by an older version keep their old shape indefinitely. Every reader in `lib/data/` coerces defensively for that reason, but a structural change would need a one-off script — there is no migration system.

### No sharing, social or coaching features

Single-user by design. No feed, no comparisons, no coach.

### Not tracked

Water intake, exercise or calories burned, micronutrients, fibre, sodium, sugar, caffeine, alcohol, body measurements beyond weight, progress photos, recipes, barcode scanning, restaurant menus.

### Metric units only

Kilograms and centimetres throughout. No imperial toggle.

### English only

No internationalisation. Dates and numbers use the browser locale, but all copy is English.

---

## Security and privacy

### What protects your data

Per-user data paths, Realtime Database Security Rules (`auth.uid === $uid` per subtree), Storage objects scoped by uid, httpOnly session cookies verified against revocation, server-side API keys, Zod validation on every input, and image type plus magic-byte verification.

The Admin SDK bypasses Security Rules by design, so on the server the *path built from the verified uid* is the access control. That is a smaller safety net than row-level security in a database that enforces it for you: a server-side path bug would not be caught by the rules. It is confined to `lib/data/` and the route handlers, and every path there is derived from the session.

### What to be aware of

- **Meal photos are uploaded to Firebase Storage** (when enabled) and served via a download URL carrying a long-lived access token. The URL is unguessable, but it does not expire on its own — revoking it means deleting the object or rotating the token in the Firebase console.
- **Photos are sent to Hugging Face** for analysis. Their handling is governed by Hugging Face's policies, not this app's. Set `FOOD_VISION_PROVIDER=mock` (or self-host the model) if that is not acceptable.
- **Food names are sent to USDA** as search queries.
- **There is no encryption at rest beyond what Firebase provides.**
- **Sessions last 14 days** (the Firebase maximum for a session cookie) unless you sign out. On a shared device, sign out.
- **Anyone with the URL can create an account** unless you add a restriction — see [DEPLOYMENT.md](DEPLOYMENT.md). Firebase has no one-click signup toggle.

### Not audited

This is a personal project. It has not had a professional security review.

---

## Verification status

To be precise about what has actually been confirmed:

**Verified directly**
- `npm run lint`, `npm run test` (133 unit tests), `npm run build` all pass
- The production server serves every route; all seven protected routes redirect when signed out
- Every API endpoint returns `401` with a clean error body when unauthenticated
- `POST /api/auth/session` rejects a bogus ID token with `401`, and malformed JSON with `400`
- No server secret (service-account key, USDA key, HF token) appears in any client bundle — checked with a scan that was itself validated against a known-present string
- The manifest, service worker, offline page and every declared icon are served correctly
- 46 Playwright e2e tests pass against a running production build
- Pages render correctly on a mobile viewport with no console errors and no horizontal overflow
- `nateraw/food` exists on Hugging Face with exactly 101 labels, Apache-2.0, `image-classification`
- The Hugging Face router endpoint responds (401 without a token); the legacy host no longer resolves

**Not verified — requires credentials this environment does not have**
- Any live Firebase call: no service-account key was available, so **no read or write against a real Realtime Database has been executed**
- Sign-in, session-cookie minting, and the full signed-in flow: onboarding, dashboard with data, logging food, diet plan generation, weight entry
- The security rules in `database.rules.json` and `storage.rules` — written against the documented syntax, never deployed or exercised
- A live Hugging Face inference call with a real `HF_TOKEN`
- A live USDA API call with a real `USDA_API_KEY`
- Photo upload to Firebase Storage
- Installing the PWA from Chrome on a real device, and camera capture on a real phone

The 20 authenticated Playwright specs in `e2e/authenticated.spec.ts` cover that second list. Provide `E2E_EMAIL` and `E2E_PASSWORD` for a real account and they will run.

---

## Summary

MyLyf is useful as a **consistent relative signal** — a way to notice that today was heavier than yesterday, or that protein is habitually low. It is not a measurement instrument.

The largest error source is portion size, which no part of this app can estimate for you. Weighing your food, even occasionally, will improve your data more than anything else.

> Nutrition and calorie values are estimates and should not be considered medical advice. Consult a qualified healthcare professional for medical or dietary conditions.
