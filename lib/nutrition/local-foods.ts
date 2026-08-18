import type { FoodItem } from '@/types/food';
import { normalizeFoodQuery } from '@/lib/utils';
import { PLANNER_FOODS } from '@/lib/diet/food-database';

/**
 * Curated per-100 g nutrition for Indian dishes, consulted before USDA.
 *
 * Why this exists: USDA FoodData Central's coverage of Indian food is thin and
 * skewed. Its FNDDS "Dosa, plain" entry is 210 kcal / 5.7 g protein / 37 g carb
 * per 100 g — a crisp, oil-heavy restaurant crepe. IFCT 2017 puts a home-style
 * plain dosa at 168 kcal / 3.9 g protein / 29 g carb. On a 350 g plate of four
 * dosas that difference is 20 g of protein versus 14 g, and 130 g of carbs
 * versus 102 g. Neither figure is a bug in the lookup — the app was simply
 * asking the wrong reference.
 *
 * Anything not listed here still goes to USDA, which remains the better source
 * for generic and Western foods.
 *
 * Matching is deliberately exact (after query normalization): a curated entry
 * only wins when the user's food name is unambiguously that dish. "Masala dosa"
 * must not silently resolve to plain dosa — it has a potato filling and its own
 * entry below.
 */

interface LocalFood {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  /** Normalized names that resolve to this entry, including the display name. */
  aliases: string[];
}

/**
 * Entries backed by the planner's table, so the two never drift apart. Keyed by
 * `PlannerFood.id`; the value is the alias list for that food.
 */
const PLANNER_ALIASES: Record<string, string[]> = {
  dosa: ['dosa', 'plain dosa', 'dosai', 'sada dosa', 'set dosa'],
  idli: ['idli', 'idly', 'iddli', 'steamed idli', 'rice idli'],
  sambar: ['sambar', 'sambhar', 'saambar', 'lentil sambar'],
  roti: ['roti', 'chapati', 'chapathi', 'phulka', 'whole wheat roti'],
  'jowar-roti': ['jowar roti', 'bajra roti', 'jowar bhakri'],
  'white-rice': ['rice', 'steamed rice', 'white rice', 'plain rice', 'boiled rice'],
  'brown-rice': ['brown rice'],
  poha: ['poha', 'pohe', 'aval', 'flattened rice'],
  upma: ['upma', 'uppma', 'rava upma', 'sooji upma'],
  daliya: ['daliya', 'dalia', 'broken wheat'],
  oats: ['oats', 'oatmeal', 'oats porridge'],
  lentils: ['dal', 'daal', 'dhal', 'toor dal', 'moong dal', 'tadka dal'],
  chickpeas: ['chana masala', 'chole', 'chickpea curry'],
  rajma: ['rajma', 'rajma curry', 'kidney bean curry'],
  paneer: ['paneer bhurji'],
  curd: ['curd', 'dahi', 'plain yogurt', 'plain curd'],
  eggs: ['boiled egg', 'boiled eggs', 'egg'],
  'egg-bhurji': ['egg bhurji', 'anda bhurji', 'scrambled egg'],
  'moong-chilla': ['moong dal chilla', 'chilla', 'cheela', 'moong chilla'],
  sprouts: ['sprouts', 'moong sprouts', 'sprouts salad'],
  'roasted-chana': ['roasted chana', 'bhuna chana', 'roasted gram'],
  'chicken-curry': ['chicken curry', 'chicken gravy'],
  'fish-curry': ['fish curry', 'meen kuzhambu'],
  'mixed-veg': ['mixed vegetable sabzi', 'mixed veg sabzi', 'veg sabzi'],
  palak: ['palak sabzi', 'palak', 'spinach sabzi'],
  bhindi: ['bhindi', 'bhindi sabzi', 'okra sabzi'],
  'cabbage-poriyal': ['cabbage poriyal', 'poriyal', 'cabbage thoran'],
  lauki: ['lauki', 'lauki sabzi', 'bottle gourd sabzi'],
  kachumber: ['kachumber', 'kachumber salad'],
  ghee: ['ghee'],
  peanuts: ['roasted peanuts', 'peanuts', 'groundnut'],
  coconut: ['grated coconut', 'fresh coconut', 'coconut'],
  'sweet-potato': ['sweet potato', 'shakarkandi', 'boiled sweet potato'],
};

/**
 * Dishes the planner does not offer but people log constantly. Values are
 * per 100 g as eaten, home-style, from IFCT 2017 where it lists the dish and
 * from the closest IFCT composite otherwise — same convention and the same
 * accuracy caveat as `lib/diet/food-database.ts`.
 */
const EXTRA_FOODS: LocalFood[] = [
  {
    name: 'Coconut chutney',
    caloriesPer100g: 150, proteinPer100g: 2.5, carbsPer100g: 6.5, fatPer100g: 13,
    aliases: ['coconut chutney', 'chutney', 'nariyal chutney', 'thengai chutney'],
  },
  {
    name: 'Masala dosa',
    caloriesPer100g: 190, proteinPer100g: 3.6, carbsPer100g: 30, fatPer100g: 6,
    aliases: ['masala dosa', 'masala dosai'],
  },
  {
    name: 'Uttapam',
    caloriesPer100g: 165, proteinPer100g: 4, carbsPer100g: 27, fatPer100g: 4.2,
    aliases: ['uttapam', 'uthappam', 'onion uttapam'],
  },
  {
    name: 'Medu vada',
    caloriesPer100g: 280, proteinPer100g: 6.5, carbsPer100g: 30, fatPer100g: 14.5,
    aliases: ['medu vada', 'vada', 'vadai', 'urad vada'],
  },
  {
    name: 'Plain paratha',
    caloriesPer100g: 320, proteinPer100g: 7, carbsPer100g: 45, fatPer100g: 12,
    aliases: ['paratha', 'plain paratha', 'tawa paratha'],
  },
  {
    name: 'Poori',
    caloriesPer100g: 360, proteinPer100g: 6.5, carbsPer100g: 44, fatPer100g: 17,
    aliases: ['poori', 'puri', 'puris'],
  },
  {
    name: 'Tomato chutney',
    caloriesPer100g: 85, proteinPer100g: 1.6, carbsPer100g: 8, fatPer100g: 5.4,
    aliases: ['tomato chutney', 'thakkali chutney'],
  },
];

/** Alias -> food, built once at module load. */
const INDEX: Map<string, LocalFood> = buildIndex();

function buildIndex(): Map<string, LocalFood> {
  const index = new Map<string, LocalFood>();

  const add = (food: LocalFood) => {
    for (const alias of [food.name, ...food.aliases]) {
      const key = normalizeFoodQuery(alias);
      // First writer wins, so a planner entry is never shadowed by an extra.
      if (key && !index.has(key)) index.set(key, food);
    }
  };

  for (const planned of PLANNER_FOODS) {
    const aliases = PLANNER_ALIASES[planned.id];
    if (!aliases) continue;
    add({
      name: planned.name,
      caloriesPer100g: planned.caloriesPer100g,
      proteinPer100g: planned.proteinPer100g,
      carbsPer100g: planned.carbsPer100g,
      fatPer100g: planned.fatPer100g,
      aliases,
    });
  }

  for (const extra of EXTRA_FOODS) add(extra);

  return index;
}

/**
 * Exact curated match for a food name, or null when the dish is not covered.
 * Returning null is the normal case — the caller falls through to USDA.
 */
export function lookupLocalFood(query: string): FoodItem | null {
  const key = normalizeFoodQuery(query);
  if (!key) return null;

  const food = INDEX.get(key);
  if (!food) return null;

  return {
    name: food.name,
    source: 'local',
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    carbsPer100g: food.carbsPer100g,
    fatPer100g: food.fatPer100g,
  };
}

/** Every alias the curated table answers to. Exported for tests. */
export function localFoodAliases(): string[] {
  return [...INDEX.keys()];
}
