/**
 * Default starting portions, in grams.
 *
 * IMPORTANT: these are NOT measured from the image. The Food-101 classifier
 * returns a label and nothing else — it has no notion of size, depth or
 * distance. These values are typical single-serving weights used purely to
 * pre-fill the portion field so the user has a sensible number to adjust.
 *
 * The UI always shows the portion as an editable field, and the disclaimer
 * tells the user to correct it. See docs/LIMITATIONS.md.
 */

/** Fallback when a food matches none of the categories below. */
export const DEFAULT_PORTION_GRAMS = 200;

interface PortionRule {
  /** Substrings matched against the normalized (lowercased) food label. */
  match: string[];
  grams: number;
  /** Description shown next to the number. */
  label: string;
}

const PORTION_RULES: PortionRule[] = [
  // Drinks
  { match: ['smoothie', 'juice', 'shake', 'latte', 'coffee', 'tea'], grams: 250, label: 'about 1 glass' },
  // Soups and stews
  { match: ['soup', 'bisque', 'chowder', 'broth', 'stew', 'ramen', 'pho'], grams: 350, label: 'about 1 bowl' },
  // Salads
  { match: ['salad', 'greens', 'slaw'], grams: 150, label: 'about 1 bowl' },
  // Rice and grain dishes
  { match: ['rice', 'biryani', 'pilaf', 'risotto', 'paella', 'fried_rice'], grams: 250, label: 'about 1 plate' },
  // Pasta and noodles
  { match: ['pasta', 'spaghetti', 'noodle', 'lasagna', 'macaroni', 'ravioli', 'gnocchi'], grams: 250, label: 'about 1 plate' },
  // Curries and gravies
  { match: ['curry', 'masala', 'dal', 'gravy', 'tikka'], grams: 200, label: 'about 1 serving' },
  // Handheld items
  { match: ['sandwich', 'burger', 'hot_dog', 'wrap', 'taco', 'burrito', 'club'], grams: 220, label: '1 item' },
  { match: ['pizza'], grams: 125, label: 'about 1 slice' },
  // Breads and baked
  { match: ['bread', 'toast', 'roti', 'naan', 'chapati', 'bagel', 'croissant', 'waffle', 'pancake'], grams: 80, label: '1 piece' },
  // Desserts
  { match: ['cake', 'pie', 'brownie', 'cheesecake', 'tiramisu', 'pudding', 'donut', 'beignet', 'baklava', 'cannoli', 'macaron', 'cupcake'], grams: 110, label: '1 slice or piece' },
  { match: ['ice_cream', 'gelato', 'sorbet', 'frozen_yogurt'], grams: 100, label: 'about 1 scoop' },
  // Proteins
  { match: ['steak', 'chicken', 'pork', 'beef', 'lamb', 'ribs', 'duck'], grams: 170, label: 'about 1 portion' },
  { match: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'scallop', 'crab', 'lobster', 'ceviche', 'sashimi'], grams: 150, label: 'about 1 fillet or portion' },
  { match: ['egg', 'omelette', 'omelet', 'frittata', 'huevos'], grams: 120, label: 'about 2 eggs' },
  // Small / snack items
  { match: ['sushi', 'dumpling', 'gyoza', 'spring_roll', 'samosa', 'nugget', 'fries', 'chips', 'nachos', 'edamame', 'hummus', 'guacamole', 'bruschetta'], grams: 120, label: 'about 1 serving' },
  // Breakfast bowls
  { match: ['oatmeal', 'porridge', 'cereal', 'yogurt', 'granola'], grams: 200, label: 'about 1 bowl' },
];

export interface PortionSuggestion {
  grams: number;
  label: string;
}

/**
 * Suggest a starting portion for a food label.
 * Always returns a value — never null — so the UI has something to pre-fill.
 */
export function suggestPortion(foodLabel: string): PortionSuggestion {
  const normalized = foodLabel.toLowerCase().replace(/\s+/g, '_');

  for (const rule of PORTION_RULES) {
    if (rule.match.some((needle) => normalized.includes(needle))) {
      return { grams: rule.grams, label: rule.label };
    }
  }

  return { grams: DEFAULT_PORTION_GRAMS, label: 'about 1 serving' };
}
