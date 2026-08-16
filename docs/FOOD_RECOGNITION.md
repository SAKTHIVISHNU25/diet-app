# Food recognition

How the vision layer works, which model it uses, and — importantly — what that model genuinely cannot do.

---

## Architecture

```
lib/vision/
  types.ts             FoodVisionProvider, FoodAnalysis, VisionError, thresholds
  provider.ts          registry + getFoodVisionProvider()
  huggingface.ts       HuggingFaceFoodProvider
  mock.ts              MockFoodProvider — offline, deterministic
  portions.ts          category-based default portions
  food-recognition.ts  pipeline: provider -> identification -> USDA lookup
```

Nothing outside this directory imports Hugging Face. The rest of the app depends on one interface:

```ts
interface FoodVisionProvider {
  readonly name: string;
  analyzeImage(input: ImageInput): Promise<FoodAnalysis>;
}

interface FoodAnalysis {
  foods: RecognizedFood[];
  notes?: string;
  confident: boolean;      // false -> the UI must ask the user to choose
  provider: string;
  model?: string;
}
```

Provider selection is by environment variable:

```bash
FOOD_VISION_PROVIDER=huggingface   # or: mock
```

An unrecognised value logs a warning and falls back to `mock` rather than crashing.

---

## Selected model

**`nateraw/food`** — https://huggingface.co/nateraw/food

| Property | Value |
|---|---|
| Architecture | `ViTForImageClassification` (Vision Transformer, base) |
| Training data | [Food-101](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/) |
| Classes | **101**, single-label |
| Input | 224 × 224 RGB |
| Licence | Apache-2.0 |
| Task | `image-classification` |
| Cost | Free via the Hugging Face serverless Inference API |

### Why this model

- **Genuinely open source.** Apache-2.0, weights public, no commercial API dependency, no vendor lock-in. It can be self-hosted later with no licence change.
- **Purpose-built for food.** Fine-tuned specifically on Food-101 rather than a general ImageNet classifier that happens to know some foods.
- **Well established.** The most-used Food-101 checkpoint on the Hub, so behaviour is predictable and documented.
- **Serverless-compatible.** Runs through the free Inference API with no infrastructure to manage, which is the point for a two-user app.
- **Small and fast.** ViT-base at 224 px is cheap enough for a free tier to serve reliably.

Alternatives considered: `prithivMLmods/Food-101-93M` (SigLIP2, newer, also Food-101 — same 101-class limitation) and `Kaludi/Food-Classification` (far fewer classes and downloads). Neither removes the fundamental constraints below, so the most established option won.

---

## What this model can and cannot do

This section is deliberately blunt. Overstating a classifier's abilities is how a calorie tracker starts lying to its users.

### It CAN

- Assign a photo to one of **101 fixed food classes**.
- Return a ranked, calibrated-ish confidence score for each class.
- Handle a clear, well-lit, centred photo of a single dish that is one of those 101 classes.

### It CANNOT

| Capability | Supported? | What actually happens |
|---|---|---|
| Multi-food detection | **No** | It is a classifier, not a detector. It returns a probability distribution over the *same* 101 classes for the whole image. A plate with rice, curry and salad yields one label, not three. |
| Portion or volume estimation | **No** | There is no size, depth or scale output whatsoever. Grams come from a lookup table, not the image. |
| Foods outside Food-101 | **No** | It has no "unknown" class. Any input is forced into its nearest of 101 classes — including a photo of a car. |
| Ingredient breakdown | **No** | "Chicken curry" is a class label, not a recipe. |
| Brand or packaged-product recognition | **No** | Food-101 is restaurant/home dishes only. |
| Cooking method | **No** | Only insofar as it is baked into a class name. |

### The 101 classes

Broadly Western restaurant and café dishes: `apple_pie`, `baby_back_ribs`, `baklava`, `beef_carpaccio`, `beignets`, `bibimbap`, `caesar_salad`, `cheesecake`, `chicken_curry`, `chocolate_cake`, `club_sandwich`, `donuts`, `dumplings`, `edamame`, `french_fries`, `fried_rice`, `guacamole`, `hamburger`, `hot_dog`, `ice_cream`, `lasagna`, `macaroni_and_cheese`, `miso_soup`, `nachos`, `omelette`, `pad_thai`, `paella`, `pancakes`, `pizza`, `ramen`, `ravioli`, `risotto`, `samosa`, `sashimi`, `spaghetti_bolognese`, `steak`, `sushi`, `tacos`, `tiramisu`, `waffles`, and 60 more.

**Notably absent:** most South Asian home cooking (dal, roti, idli, dosa, poha, rajma, paneer dishes), most East Asian home cooking, most African and Middle Eastern dishes, and virtually all plain single ingredients (an apple, a chicken breast, a bowl of rice).

If you eat outside this distribution, expect recognition to be wrong often. That is not a bug in the integration — it is the dataset. **Manual entry is a first-class path in this app for exactly this reason**, not a fallback bolted on.

---

## Confidence handling

```ts
export const CONFIDENCE_THRESHOLD = 0.4;
```

Below this, the pipeline returns **no candidate at all**:

```ts
if (!top || !analysis.confident || top.confidence < CONFIDENCE_THRESHOLD) {
  return { analysis, candidates: [], alternatives: /* the guesses */, ... };
}
```

The UI then shows:

> **Food could not be identified confidently.**
> Please select or enter the food manually.

with the model's guesses listed as informational text — clearly labelled as guesses, not offered as a pre-filled answer.

The threshold is a **guard rail, not a tuned value**. Because the model has no "unknown" class, it can be confidently wrong on out-of-distribution images. 0.4 filters the obviously uncertain cases; it cannot detect the confidently-wrong ones. That is why user confirmation is mandatory rather than advisory.

---

## Portion estimation

**The model contributes nothing here.** `lib/vision/portions.ts` maps a food label to a typical single-serving weight:

```ts
{ match: ['pizza'], grams: 125, label: 'about 1 slice' }
{ match: ['soup', 'ramen', 'pho'], grams: 350, label: 'about 1 bowl' }
{ match: ['rice', 'biryani', 'risotto'], grams: 250, label: 'about 1 plate' }
// ...fallback: 200 g
```

The distinction is recorded in the data itself:

```ts
portionSource: 'category_default'   // never 'model'
```

and surfaced to the user:

> Portion is a typical serving size, not measured from the photo. Adjust it if needed.

The portion field is always editable and always visible before saving. If someone photographs a 600 g portion of biryani and accepts the 250 g default, the log will be wrong — which is why the number is presented as a starting point to correct, not as a measurement.

---

## Image processing

**Client** (`lib/utils/image.ts`)

1. Reject anything that is not JPEG/PNG/WebP.
2. Reject files over ~48 MB before decoding (decoding a huge image would hang the tab).
3. Files ≤ 600 KB pass through untouched — re-encoding would only lose quality.
4. Larger files are drawn to a canvas, downscaled so the longest edge is ≤ 1024 px, and re-encoded as JPEG at quality 0.82.
5. If canvas processing fails, fall back to the original when it is within the size limit.

A typical 8 MB phone photo becomes roughly 150 KB. The model resizes to 224 px anyway, so nothing useful is lost — this is purely bandwidth.

**Server** (`app/api/food/analyze/route.ts`)

1. Authenticate.
2. Reject anything over 8 MB (`MAX_IMAGE_BYTES`).
3. Reject a MIME type outside the allow-list.
4. **Verify the leading bytes** against the JPEG (`FF D8 FF`), PNG (`89 50 4E 47 …`) and WebP (`RIFF … WEBP`) signatures. A client can claim any MIME type; the header is what we trust.
5. Forward the raw bytes to the provider.

---

## Manual correction

Every value on the review screen is editable before anything is written:

| Action | How |
|---|---|
| Edit the food name | Text input; re-look-up nutrition with one tap |
| Change the portion | Numeric input; nutrition rescales live |
| Pick a different food | Tap one of the model's alternative predictions |
| Replace it entirely | Search USDA FoodData Central by name |
| Delete the detected item | Trash button on the card |
| Add another food | "Add another food" — this is how multiple foods on one plate are handled |
| Choose the meal | Breakfast / Lunch / Snack / Dinner / Other, defaulted by time of day |

Nothing reaches `food_logs` until "Add to today's log" is pressed.

---

## Error handling

`VisionError` carries a typed `kind`, mapped to a user-facing message by `describeVisionError()`:

| Kind | Cause | Message |
|---|---|---|
| `not_configured` | `HF_TOKEN` unset, or credentials rejected | "Food recognition is not configured. You can still add foods manually." |
| `insufficient_permissions` | HTTP 403 — token lacks the "Make calls to Inference Providers" permission (common with fine-grained tokens) | Names the missing permission and links to the tokens page |
| `model_loading` | HTTP 503, serverless cold start | "The recognition model is starting up. Please try again in a few seconds." |
| `rate_limited` | HTTP 429 | "Too many requests to the recognition service. Please try again shortly." |
| `timeout` | > 30 s | "Food recognition took too long. Please try again or add the food manually." |
| `invalid_response` | Unexpected response shape | "Food recognition is unavailable right now…" |
| `unavailable` | Network failure, 5xx | "Food recognition is unavailable right now. You can still add foods manually." |

Upstream error bodies are never forwarded — they can echo request details. The token is sent as an `Authorization` header, never in a URL.

**Every failure path leads to manual entry, not a dead end.** When analysis fails, the client drops the user straight into the review screen with an empty candidate list.

---

## Replacing the model

### Same task, different model

```bash
HF_FOOD_MODEL=prithivMLmods/Food-101-93M
```

Any Hugging Face `image-classification` model works — the response format is identical. Update the class-count claims in this document if you switch to something that is not Food-101.

### A different provider entirely

1. Implement `FoodVisionProvider` in `lib/vision/`.
2. Register it in `provider.ts`:

```ts
const PROVIDERS: Record<string, () => FoodVisionProvider> = {
  huggingface: () => new HuggingFaceFoodProvider(),
  mock: () => new MockFoodProvider(),
  myprovider: () => new MyProvider(),   // <-- add here
};
```

3. Set `FOOD_VISION_PROVIDER=myprovider`.

No other file changes.

### Where genuine multi-food support would slot in

`FoodAnalysis.foods` is already an array, and the review UI already renders a list of independently editable candidates. Today the classifier can only fill it with alternative labels for *one* item, which is why `food-recognition.ts` promotes only the top prediction to a candidate and passes the rest as `alternatives`.

An object-detection model (DETR/YOLO fine-tuned on food, or a multimodal model returning a food list) would return several genuine foods. Then:

- populate `foods` with each detected item,
- have `recognizeFood()` create one candidate per food instead of only the top one,
- optionally set `portionSource: 'model'` where the model can actually estimate size.

The UI, API contract and database need no changes.

---

## Testing

`tests/vision.test.ts` (19 tests) covers, with `fetch` stubbed:

- Provider resolution, defaults, case-insensitivity and the invalid-value fallback.
- Response normalisation, including the doubly-nested array some deployments return.
- Status mapping: 401 → `not_configured`, 429 → `rate_limited`, 503 → `model_loading`, 500 → `unavailable`.
- Low-confidence results being marked `confident: false`.
- Empty and malformed responses not throwing raw errors.
- **The token appearing only in the `Authorization` header and never in the URL.**
- Network failures surfacing as `VisionError` without leaking the underlying message.

`MockFoodProvider` makes the whole flow testable offline: it derives a deterministic result from the image byte length and clearly labels itself as not a real identification.

---

## Verification status

The integration is unit-tested against stubbed responses, and the provider abstraction, error mapping, thresholds and UI flow are all exercised.

**A live end-to-end call to Hugging Face has not been executed** — that needs a real `HF_TOKEN`. What was verified directly:

- `nateraw/food` exists, is tagged `image-classification`, is trained on `food101`, is Apache-2.0, and has exactly **101** labels in its `config.json`.
- The legacy `api-inference.huggingface.co` host no longer resolves; `https://router.huggingface.co/hf-inference/models/<model>` responds (401 without a token), which is why the router URL is the default.

Add your token and scan a photo to confirm live behaviour end to end.
