import type { DietaryPreference } from '@/types/user';

/**
 * Curated food database used by the template diet planner.
 *
 * Deliberately Indian and deliberately ordinary: every entry is something that
 * can be cooked in a normal Indian kitchen from ingredients sold at any local
 * store — dal, sabzi, chapati, idli, curd, chana. Nothing here needs a
 * speciality shop, an imported ingredient or a recipe the user has to look up,
 * because a plan is only useful if it is actually cooked.
 *
 * Nutrition is per 100 g of the food *as eaten* (cooked, home-style, with the
 * oil a typical household would use). Figures come from IFCT 2017 and USDA
 * FoodData Central reference entries, rounded. They are estimates for a generic
 * preparation, not for any specific recipe — a richer restaurant version of the
 * same dish will be higher.
 *
 * This exists so the planner works with no network access and no AI API key.
 */

export type FoodTag =
  | 'protein'
  | 'carb'
  | 'vegetable'
  | 'fat'
  | 'fruit'
  | 'dairy';

export interface PlannerFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  tag: FoodTag;
  /** Diets this food is acceptable for. */
  diets: DietaryPreference[];
  /** Typical serving in grams, used as the starting portion before scaling. */
  baseGrams: number;
  /** Bounds the planner must respect when scaling the portion. */
  minGrams: number;
  maxGrams: number;
  /** Allergen keywords matched against the user's allergy list. */
  allergens: string[];
  /** Which meals this food is a natural fit for. */
  meals: ('breakfast' | 'lunch' | 'snack' | 'dinner')[];
}

const ALL: DietaryPreference[] = [
  'vegetarian',
  'non_vegetarian',
  'vegan',
  'eggetarian',
];
const VEG_OK: DietaryPreference[] = ['vegetarian', 'non_vegetarian', 'eggetarian'];
const MEAT_ONLY: DietaryPreference[] = ['non_vegetarian'];
const EGG_OK: DietaryPreference[] = ['non_vegetarian', 'eggetarian'];

export const PLANNER_FOODS: PlannerFood[] = [
  // ---------------------------------------------------------------- proteins
  {
    id: 'chicken-curry',
    name: 'Home-style chicken curry',
    caloriesPer100g: 150, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 7.5,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 180, minGrams: 120, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'chicken-breast',
    name: 'Tandoori chicken (boneless)',
    caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 1, fatPer100g: 4,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 150, minGrams: 90, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'fish-curry',
    name: 'Fish curry',
    caloriesPer100g: 130, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 5.5,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 150, minGrams: 90, maxGrams: 250,
    allergens: ['fish', 'seafood'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'eggs',
    name: 'Boiled eggs',
    caloriesPer100g: 155, proteinPer100g: 12.6, carbsPer100g: 1.1, fatPer100g: 10.6,
    tag: 'protein', diets: EGG_OK, baseGrams: 100, minGrams: 50, maxGrams: 200,
    allergens: ['egg'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'egg-bhurji',
    name: 'Egg bhurji',
    caloriesPer100g: 165, proteinPer100g: 11, carbsPer100g: 3, fatPer100g: 12,
    tag: 'protein', diets: EGG_OK, baseGrams: 150, minGrams: 90, maxGrams: 250,
    allergens: ['egg'], meals: ['breakfast', 'dinner'],
  },
  {
    id: 'paneer',
    name: 'Paneer bhurji',
    caloriesPer100g: 265, proteinPer100g: 18.3, carbsPer100g: 1.2, fatPer100g: 20.8,
    tag: 'protein', diets: VEG_OK, baseGrams: 100, minGrams: 50, maxGrams: 160,
    allergens: ['dairy', 'milk'], meals: ['breakfast', 'lunch', 'dinner'],
  },
  {
    id: 'lentils',
    name: 'Dal (toor or moong)',
    caloriesPer100g: 100, proteinPer100g: 6, carbsPer100g: 13, fatPer100g: 2.8,
    tag: 'protein', diets: ALL, baseGrams: 250, minGrams: 150, maxGrams: 400,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'sambar',
    name: 'Sambar',
    caloriesPer100g: 70, proteinPer100g: 3.2, carbsPer100g: 9.5, fatPer100g: 2.2,
    tag: 'protein', diets: ALL, baseGrams: 250, minGrams: 150, maxGrams: 400,
    allergens: [], meals: ['breakfast', 'lunch', 'dinner'],
  },
  {
    id: 'chickpeas',
    name: 'Chana masala',
    caloriesPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6,
    tag: 'protein', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'rajma',
    name: 'Rajma curry',
    caloriesPer100g: 130, proteinPer100g: 7.5, carbsPer100g: 20, fatPer100g: 3,
    tag: 'protein', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 320,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'soya-chunks',
    name: 'Soya chunk curry',
    caloriesPer100g: 115, proteinPer100g: 14, carbsPer100g: 8, fatPer100g: 2.5,
    tag: 'protein', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 280,
    allergens: ['soy'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'tofu',
    name: 'Tofu bhurji',
    caloriesPer100g: 76, proteinPer100g: 8.1, carbsPer100g: 1.9, fatPer100g: 4.8,
    tag: 'protein', diets: ALL, baseGrams: 150, minGrams: 100, maxGrams: 250,
    allergens: ['soy'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'moong-chilla',
    name: 'Moong dal chilla',
    caloriesPer100g: 145, proteinPer100g: 9, carbsPer100g: 18, fatPer100g: 4,
    tag: 'protein', diets: ALL, baseGrams: 150, minGrams: 100, maxGrams: 250,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'sprouts',
    name: 'Moong sprouts salad',
    caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 18, fatPer100g: 0.6,
    tag: 'protein', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'roasted-chana',
    name: 'Roasted chana',
    caloriesPer100g: 364, proteinPer100g: 20, carbsPer100g: 61, fatPer100g: 6,
    tag: 'protein', diets: ALL, baseGrams: 40, minGrams: 20, maxGrams: 80,
    allergens: [], meals: ['snack'],
  },
  {
    id: 'curd',
    name: 'Curd (dahi)',
    caloriesPer100g: 62, proteinPer100g: 3.4, carbsPer100g: 4.7, fatPer100g: 3.3,
    tag: 'dairy', diets: VEG_OK, baseGrams: 200, minGrams: 100, maxGrams: 350,
    allergens: ['dairy', 'milk'], meals: ['breakfast', 'lunch', 'snack'],
  },

  // ------------------------------------------------------------------- carbs
  {
    id: 'roti',
    name: 'Chapati (whole wheat)',
    caloriesPer100g: 280, proteinPer100g: 9.5, carbsPer100g: 48, fatPer100g: 6.5,
    tag: 'carb', diets: ALL, baseGrams: 90, minGrams: 40, maxGrams: 180,
    allergens: ['wheat', 'gluten'], meals: ['breakfast', 'lunch', 'dinner'],
  },
  {
    id: 'jowar-roti',
    name: 'Jowar or bajra roti',
    caloriesPer100g: 250, proteinPer100g: 7, carbsPer100g: 50, fatPer100g: 2.5,
    tag: 'carb', diets: ALL, baseGrams: 100, minGrams: 50, maxGrams: 200,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'white-rice',
    name: 'Steamed rice',
    caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28.2, fatPer100g: 0.3,
    tag: 'carb', diets: ALL, baseGrams: 180, minGrams: 80, maxGrams: 350,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'brown-rice',
    name: 'Brown rice',
    caloriesPer100g: 123, proteinPer100g: 2.7, carbsPer100g: 25.6, fatPer100g: 1,
    tag: 'carb', diets: ALL, baseGrams: 180, minGrams: 80, maxGrams: 350,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'idli',
    name: 'Idli',
    caloriesPer100g: 135, proteinPer100g: 3.4, carbsPer100g: 28, fatPer100g: 0.4,
    tag: 'carb', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 300,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'dosa',
    name: 'Plain dosa',
    caloriesPer100g: 168, proteinPer100g: 3.9, carbsPer100g: 29, fatPer100g: 3.7,
    tag: 'carb', diets: ALL, baseGrams: 130, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['breakfast', 'dinner'],
  },
  {
    id: 'poha',
    name: 'Poha',
    caloriesPer100g: 130, proteinPer100g: 2.5, carbsPer100g: 27, fatPer100g: 1.5,
    tag: 'carb', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 320,
    allergens: [], meals: ['breakfast'],
  },
  {
    id: 'upma',
    name: 'Rava upma',
    caloriesPer100g: 135, proteinPer100g: 3, carbsPer100g: 19, fatPer100g: 5,
    tag: 'carb', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 320,
    allergens: ['wheat', 'gluten'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'daliya',
    name: 'Daliya (broken wheat)',
    caloriesPer100g: 95, proteinPer100g: 3, carbsPer100g: 19, fatPer100g: 0.7,
    tag: 'carb', diets: ALL, baseGrams: 250, minGrams: 150, maxGrams: 400,
    allergens: ['wheat', 'gluten'], meals: ['breakfast', 'dinner'],
  },
  {
    id: 'oats',
    name: 'Oats porridge',
    caloriesPer100g: 68, proteinPer100g: 2.4, carbsPer100g: 12, fatPer100g: 1.4,
    tag: 'carb', diets: ALL, baseGrams: 250, minGrams: 150, maxGrams: 450,
    allergens: ['oats', 'gluten'], meals: ['breakfast'],
  },
  {
    id: 'whole-wheat-bread',
    name: 'Whole wheat bread',
    caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4,
    tag: 'carb', diets: ALL, baseGrams: 60, minGrams: 30, maxGrams: 120,
    allergens: ['wheat', 'gluten'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'sweet-potato',
    name: 'Boiled sweet potato (shakarkandi)',
    caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20.1, fatPer100g: 0.1,
    tag: 'carb', diets: ALL, baseGrams: 200, minGrams: 100, maxGrams: 350,
    allergens: [], meals: ['breakfast', 'snack', 'lunch', 'dinner'],
  },

  // -------------------------------------------------------------- vegetables
  {
    id: 'mixed-veg',
    name: 'Mixed vegetable sabzi',
    caloriesPer100g: 75, proteinPer100g: 2.6, carbsPer100g: 11, fatPer100g: 2.8,
    tag: 'vegetable', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'palak',
    name: 'Palak sabzi',
    caloriesPer100g: 65, proteinPer100g: 3, carbsPer100g: 5, fatPer100g: 3.5,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'bhindi',
    name: 'Bhindi sabzi',
    caloriesPer100g: 85, proteinPer100g: 2, carbsPer100g: 8, fatPer100g: 5,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'cabbage-poriyal',
    name: 'Cabbage poriyal',
    caloriesPer100g: 60, proteinPer100g: 1.8, carbsPer100g: 7, fatPer100g: 3,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'lauki',
    name: 'Lauki sabzi',
    caloriesPer100g: 45, proteinPer100g: 0.9, carbsPer100g: 5, fatPer100g: 2.4,
    tag: 'vegetable', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'kachumber',
    name: 'Kachumber salad',
    caloriesPer100g: 25, proteinPer100g: 0.8, carbsPer100g: 4.5, fatPer100g: 0.3,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner', 'snack'],
  },

  // ------------------------------------------------------------ fats & fruit
  {
    id: 'ghee',
    name: 'Ghee',
    caloriesPer100g: 900, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100,
    tag: 'fat', diets: VEG_OK, baseGrams: 8, minGrams: 5, maxGrams: 20,
    allergens: ['dairy', 'milk'], meals: ['breakfast', 'lunch', 'dinner'],
  },
  {
    id: 'cooking-oil',
    name: 'Cooking oil (mustard or groundnut)',
    caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100,
    tag: 'fat', diets: ALL, baseGrams: 10, minGrams: 5, maxGrams: 25,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'peanuts',
    name: 'Roasted peanuts',
    caloriesPer100g: 567, proteinPer100g: 25.8, carbsPer100g: 16.1, fatPer100g: 49.2,
    tag: 'fat', diets: ALL, baseGrams: 30, minGrams: 10, maxGrams: 60,
    allergens: ['peanut', 'nuts'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'almonds',
    name: 'Almonds',
    caloriesPer100g: 579, proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9,
    tag: 'fat', diets: ALL, baseGrams: 25, minGrams: 10, maxGrams: 50,
    allergens: ['nuts', 'tree nuts', 'almond'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'coconut',
    name: 'Fresh grated coconut',
    caloriesPer100g: 354, proteinPer100g: 3.3, carbsPer100g: 15.2, fatPer100g: 33.5,
    tag: 'fat', diets: ALL, baseGrams: 20, minGrams: 10, maxGrams: 40,
    allergens: ['coconut'], meals: ['breakfast', 'lunch', 'dinner'],
  },
  {
    id: 'banana',
    name: 'Banana',
    caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
    tag: 'fruit', diets: ALL, baseGrams: 120, minGrams: 80, maxGrams: 200,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'papaya',
    name: 'Papaya',
    caloriesPer100g: 43, proteinPer100g: 0.5, carbsPer100g: 11, fatPer100g: 0.3,
    tag: 'fruit', diets: ALL, baseGrams: 200, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'apple',
    name: 'Apple',
    caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 13.8, fatPer100g: 0.2,
    tag: 'fruit', diets: ALL, baseGrams: 150, minGrams: 100, maxGrams: 250,
    allergens: [], meals: ['snack'],
  },
  {
    id: 'dates',
    name: 'Dates (khajur)',
    caloriesPer100g: 277, proteinPer100g: 1.8, carbsPer100g: 75, fatPer100g: 0.2,
    tag: 'fruit', diets: ALL, baseGrams: 30, minGrams: 15, maxGrams: 60,
    allergens: [], meals: ['snack'],
  },
];

/**
 * Filter the database to what a user can actually eat.
 * Allergy matching is substring-based on lowercased text, in both directions,
 * so "nuts" matches the "tree nuts" allergen and vice versa.
 */
export function filterFoods(
  preference: DietaryPreference,
  allergies: string[],
  dislikes: string[] = [],
): PlannerFood[] {
  const normalizedAllergies = allergies
    .map((a) => a.toLowerCase().trim())
    .filter(Boolean);
  const normalizedDislikes = dislikes.map((d) => d.toLowerCase().trim()).filter(Boolean);

  return PLANNER_FOODS.filter((food) => {
    if (!food.diets.includes(preference)) return false;

    const hasAllergen = food.allergens.some((allergen) =>
      normalizedAllergies.some(
        (userAllergy) =>
          allergen.includes(userAllergy) || userAllergy.includes(allergen),
      ),
    );
    if (hasAllergen) return false;

    const isDisliked = normalizedDislikes.some((dislike) =>
      food.name.toLowerCase().includes(dislike),
    );
    if (isDisliked) return false;

    return true;
  });
}
