/**
 * Default starting portions, in grams, and the plausible range around them.
 *
 * IMPORTANT: these are NOT measured from the image. A classifier returns a
 * label and nothing else — it has no notion of size, depth or distance. A VLM
 * does guess a weight, but it is a language model's visual guess with no depth
 * data, no reference object and no scale, so it is regularly out by a factor of
 * two or three. These values are typical single-serving weights used to
 * pre-fill the portion field and to bound a model's guess to something a plate
 * can actually hold.
 *
 * Why the bound matters: every macro is derived from grams alone
 * (`calculateNutritionForGrams`). A dosa read as 350 g does not just show a
 * wrong weight — it reports roughly three dosas' worth of protein, carbs and
 * calories with no visible sign that anything is off.
 *
 * The UI always shows the portion as an editable field, and the disclaimer
 * tells the user to correct it. See docs/LIMITATIONS.md.
 */

/** Fallback when a food matches none of the categories below. */
export const DEFAULT_PORTION_GRAMS = 200;

/** Range applied to foods that match no rule. Wide, but not unbounded. */
const DEFAULT_MIN_GRAMS = 20;
const DEFAULT_MAX_GRAMS = 600;

interface PortionRule {
  /** Substrings matched against the normalized (lowercased) food label. */
  match: string[];
  grams: number;
  /**
   * Plausible range for ONE serving/piece of this food. Bounds are scaled by
   * the reported quantity, so "3 dosas" is allowed 3x the single-dosa maximum.
   */
  min: number;
  max: number;
  /** Description shown next to the number. */
  label: string;
}

const PORTION_RULES: PortionRule[] = [
  // Drinks
  { match: ['smoothie', 'juice', 'shake', 'latte', 'coffee', 'tea'], grams: 250, min: 100, max: 500, label: 'about 1 glass' },
  // Soups and stews
  { match: ['soup', 'bisque', 'chowder', 'broth', 'stew', 'ramen', 'pho'], grams: 350, min: 150, max: 600, label: 'about 1 bowl' },
  // Salads
  { match: ['salad', 'greens', 'slaw'], grams: 150, min: 60, max: 400, label: 'about 1 bowl' },
  // Rice and grain dishes
  { match: ['rice', 'biryani', 'pilaf', 'risotto', 'paella', 'fried_rice'], grams: 250, min: 100, max: 450, label: 'about 1 plate' },
  // Pasta and noodles
  { match: ['pasta', 'spaghetti', 'noodle', 'lasagna', 'macaroni', 'ravioli', 'gnocchi'], grams: 250, min: 100, max: 450, label: 'about 1 plate' },
  // Curries and gravies
  { match: ['curry', 'masala', 'dal', 'sambar', 'rasam', 'gravy', 'tikka', 'chutney'], grams: 200, min: 40, max: 400, label: 'about 1 serving' },
  // South Indian batter items — sized per piece, not per plate. A plain dosa is
  // roughly 80-100 g; a plate of three is still ~300 g, so the range is scaled
  // by quantity rather than widened here.
  { match: ['dosa', 'dosai', 'uttapam', 'uthappam', 'pesarattu', 'appam', 'adai'], grams: 90, min: 50, max: 160, label: '1 dosa' },
  { match: ['idli', 'idly', 'vada', 'vadai', 'medu_vada', 'paniyaram', 'appe'], grams: 45, min: 25, max: 90, label: '1 piece' },
  // Indian breads
  { match: ['paratha', 'parotta', 'poori', 'puri', 'kulcha', 'bhatura'], grams: 70, min: 35, max: 140, label: '1 piece' },
  // Handheld items
  { match: ['sandwich', 'burger', 'hot_dog', 'wrap', 'taco', 'burrito', 'club'], grams: 220, min: 80, max: 400, label: '1 item' },
  { match: ['pizza'], grams: 125, min: 60, max: 250, label: 'about 1 slice' },
  // Breads and baked
  { match: ['bread', 'toast', 'roti', 'naan', 'chapati', 'chapathi', 'bagel', 'croissant', 'waffle', 'pancake'], grams: 80, min: 25, max: 160, label: '1 piece' },
  // Desserts
  { match: ['cake', 'pie', 'brownie', 'cheesecake', 'tiramisu', 'pudding', 'donut', 'beignet', 'baklava', 'cannoli', 'macaron', 'cupcake'], grams: 110, min: 40, max: 250, label: '1 slice or piece' },
  { match: ['ice_cream', 'gelato', 'sorbet', 'frozen_yogurt'], grams: 100, min: 40, max: 250, label: 'about 1 scoop' },
  // Proteins
  { match: ['steak', 'chicken', 'pork', 'beef', 'lamb', 'ribs', 'duck'], grams: 170, min: 60, max: 350, label: 'about 1 portion' },
  { match: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'scallop', 'crab', 'lobster', 'ceviche', 'sashimi'], grams: 150, min: 50, max: 320, label: 'about 1 fillet or portion' },
  { match: ['egg', 'omelette', 'omelet', 'frittata', 'huevos'], grams: 120, min: 40, max: 300, label: 'about 2 eggs' },
  // Small / snack items
  { match: ['sushi', 'dumpling', 'gyoza', 'spring_roll', 'samosa', 'nugget', 'fries', 'chips', 'nachos', 'edamame', 'hummus', 'guacamole', 'bruschetta'], grams: 120, min: 30, max: 300, label: 'about 1 serving' },
  // Breakfast bowls
  { match: ['oatmeal', 'porridge', 'cereal', 'yogurt', 'granola', 'upma', 'poha'], grams: 200, min: 80, max: 400, label: 'about 1 bowl' },
];

export interface PortionSuggestion {
  grams: number;
  label: string;
}

function findRule(foodLabel: string): PortionRule | null {
  const normalized = foodLabel.toLowerCase().replace(/\s+/g, '_');
  return (
    PORTION_RULES.find((rule) => rule.match.some((needle) => normalized.includes(needle))) ??
    null
  );
}

/**
 * Suggest a starting portion for a food label.
 * Always returns a value — never null — so the UI has something to pre-fill.
 */
export function suggestPortion(foodLabel: string): PortionSuggestion {
  const rule = findRule(foodLabel);
  if (rule) return { grams: rule.grams, label: rule.label };
  return { grams: DEFAULT_PORTION_GRAMS, label: 'about 1 serving' };
}

/**
 * Plausible weight range for a food, scaled by how many pieces were reported.
 * Exported for tests and for callers that want to validate a user-typed value.
 */
export function plausibleRange(
  foodLabel: string,
  quantity = 1,
): { min: number; max: number } {
  const rule = findRule(foodLabel);
  // A quantity of 0 or a nonsense value should not collapse the range to zero.
  const pieces = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  return {
    min: Math.round((rule?.min ?? DEFAULT_MIN_GRAMS) * Math.max(1, pieces)),
    max: Math.round((rule?.max ?? DEFAULT_MAX_GRAMS) * pieces),
  };
}

export interface ClampedPortion {
  grams: number;
  /** True when the model's number was outside the plausible range. */
  clamped: boolean;
  /** The value before clamping, present only when `clamped` is true. */
  originalGrams?: number;
}

/**
 * Bound a model-estimated weight to what the food can plausibly weigh.
 *
 * This is the guard between "the model guessed a number" and "every macro is
 * that number times a per-100 g density". Without it a single overestimate
 * silently inflates protein, carbs, fat and calories together.
 */
export function clampPortion(
  foodLabel: string,
  grams: number,
  quantity = 1,
): ClampedPortion {
  if (!Number.isFinite(grams) || grams <= 0) {
    const fallback = suggestPortion(foodLabel);
    const pieces = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    return { grams: Math.round(fallback.grams * pieces), clamped: false };
  }

  const { min, max } = plausibleRange(foodLabel, quantity);
  const bounded = Math.min(max, Math.max(min, grams));
  const rounded = Math.round(bounded);

  return rounded === Math.round(grams)
    ? { grams: rounded, clamped: false }
    : { grams: rounded, clamped: true, originalGrams: Math.round(grams) };
}
