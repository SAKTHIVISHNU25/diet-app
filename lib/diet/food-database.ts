import type { DietaryPreference } from '@/types/user';

/**
 * Curated food database used by the template diet planner.
 *
 * Nutrition is per 100 g and is drawn from USDA FoodData Central reference
 * entries (SR Legacy / Foundation). Values are rounded and are estimates for a
 * generic preparation, not for any specific recipe or brand.
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
    id: 'chicken-breast',
    name: 'Grilled chicken breast',
    caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 150, minGrams: 90, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'salmon',
    name: 'Baked salmon',
    caloriesPer100g: 208, proteinPer100g: 20.4, carbsPer100g: 0, fatPer100g: 13.4,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 140, minGrams: 90, maxGrams: 220,
    allergens: ['fish', 'seafood'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'tuna',
    name: 'Tuna (canned in water)',
    caloriesPer100g: 116, proteinPer100g: 25.5, carbsPer100g: 0, fatPer100g: 0.8,
    tag: 'protein', diets: MEAT_ONLY, baseGrams: 120, minGrams: 80, maxGrams: 200,
    allergens: ['fish', 'seafood'], meals: ['lunch', 'snack'],
  },
  {
    id: 'eggs',
    name: 'Boiled eggs',
    caloriesPer100g: 155, proteinPer100g: 12.6, carbsPer100g: 1.1, fatPer100g: 10.6,
    tag: 'protein', diets: EGG_OK, baseGrams: 100, minGrams: 50, maxGrams: 180,
    allergens: ['egg'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'omelette',
    name: 'Vegetable omelette',
    caloriesPer100g: 154, proteinPer100g: 10.6, carbsPer100g: 2.4, fatPer100g: 11.2,
    tag: 'protein', diets: EGG_OK, baseGrams: 150, minGrams: 90, maxGrams: 250,
    allergens: ['egg'], meals: ['breakfast'],
  },
  {
    id: 'paneer',
    name: 'Paneer',
    caloriesPer100g: 265, proteinPer100g: 18.3, carbsPer100g: 1.2, fatPer100g: 20.8,
    tag: 'protein', diets: VEG_OK, baseGrams: 100, minGrams: 50, maxGrams: 160,
    allergens: ['dairy', 'milk'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'tofu',
    name: 'Pan-seared tofu',
    caloriesPer100g: 76, proteinPer100g: 8.1, carbsPer100g: 1.9, fatPer100g: 4.8,
    tag: 'protein', diets: ALL, baseGrams: 150, minGrams: 100, maxGrams: 250,
    allergens: ['soy'], meals: ['lunch', 'dinner'],
  },
  {
    id: 'lentils',
    name: 'Cooked lentils (dal)',
    caloriesPer100g: 116, proteinPer100g: 9, carbsPer100g: 20.1, fatPer100g: 0.4,
    tag: 'protein', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 350,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'chickpeas',
    name: 'Chickpea curry',
    caloriesPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6,
    tag: 'protein', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'rajma',
    name: 'Kidney bean curry',
    caloriesPer100g: 127, proteinPer100g: 8.7, carbsPer100g: 22.8, fatPer100g: 0.5,
    tag: 'protein', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 320,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'greek-yogurt',
    name: 'Greek yogurt',
    caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4,
    tag: 'dairy', diets: VEG_OK, baseGrams: 170, minGrams: 100, maxGrams: 300,
    allergens: ['dairy', 'milk'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'cottage-cheese',
    name: 'Low-fat cottage cheese',
    caloriesPer100g: 72, proteinPer100g: 12.4, carbsPer100g: 2.7, fatPer100g: 1,
    tag: 'dairy', diets: VEG_OK, baseGrams: 150, minGrams: 100, maxGrams: 250,
    allergens: ['dairy', 'milk'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'soy-yogurt',
    name: 'Soy yogurt',
    caloriesPer100g: 54, proteinPer100g: 3.5, carbsPer100g: 5.4, fatPer100g: 1.8,
    tag: 'dairy', diets: ['vegan'], baseGrams: 170, minGrams: 100, maxGrams: 280,
    allergens: ['soy'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'sprouts',
    name: 'Mixed sprouts salad',
    caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 18, fatPer100g: 0.6,
    tag: 'protein', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['breakfast', 'snack'],
  },

  // ------------------------------------------------------------------- carbs
  {
    id: 'brown-rice',
    name: 'Brown rice',
    caloriesPer100g: 123, proteinPer100g: 2.7, carbsPer100g: 25.6, fatPer100g: 1,
    tag: 'carb', diets: ALL, baseGrams: 180, minGrams: 80, maxGrams: 350,
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
    id: 'roti',
    name: 'Whole wheat roti',
    caloriesPer100g: 297, proteinPer100g: 11, carbsPer100g: 51, fatPer100g: 7,
    tag: 'carb', diets: ALL, baseGrams: 90, minGrams: 40, maxGrams: 180,
    allergens: ['wheat', 'gluten'], meals: ['lunch', 'dinner'],
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
    name: 'Whole wheat toast',
    caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4,
    tag: 'carb', diets: ALL, baseGrams: 60, minGrams: 30, maxGrams: 120,
    allergens: ['wheat', 'gluten'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'sweet-potato',
    name: 'Roasted sweet potato',
    caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20.1, fatPer100g: 0.1,
    tag: 'carb', diets: ALL, baseGrams: 200, minGrams: 100, maxGrams: 350,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'quinoa',
    name: 'Quinoa',
    caloriesPer100g: 120, proteinPer100g: 4.4, carbsPer100g: 21.3, fatPer100g: 1.9,
    tag: 'carb', diets: ALL, baseGrams: 180, minGrams: 90, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'poha',
    name: 'Poha',
    caloriesPer100g: 130, proteinPer100g: 2.5, carbsPer100g: 27, fatPer100g: 1.5,
    tag: 'carb', diets: ALL, baseGrams: 200, minGrams: 120, maxGrams: 320,
    allergens: [], meals: ['breakfast'],
  },
  {
    id: 'idli',
    name: 'Idli',
    caloriesPer100g: 156, proteinPer100g: 4, carbsPer100g: 32, fatPer100g: 0.4,
    tag: 'carb', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 300,
    allergens: [], meals: ['breakfast'],
  },

  // -------------------------------------------------------------- vegetables
  {
    id: 'broccoli',
    name: 'Steamed broccoli',
    caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 6.6, fatPer100g: 0.4,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'spinach',
    name: 'Sauteed spinach',
    caloriesPer100g: 45, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 2.4,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'mixed-veg',
    name: 'Mixed vegetable sabzi',
    caloriesPer100g: 65, proteinPer100g: 2.6, carbsPer100g: 13.1, fatPer100g: 0.4,
    tag: 'vegetable', diets: ALL, baseGrams: 180, minGrams: 100, maxGrams: 300,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'salad',
    name: 'Garden salad',
    caloriesPer100g: 20, proteinPer100g: 1, carbsPer100g: 4, fatPer100g: 0.2,
    tag: 'vegetable', diets: ALL, baseGrams: 150, minGrams: 80, maxGrams: 250,
    allergens: [], meals: ['lunch', 'dinner', 'snack'],
  },

  // ------------------------------------------------------------ fats & fruit
  {
    id: 'almonds',
    name: 'Almonds',
    caloriesPer100g: 579, proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9,
    tag: 'fat', diets: ALL, baseGrams: 25, minGrams: 10, maxGrams: 50,
    allergens: ['nuts', 'tree nuts', 'almond'], meals: ['snack', 'breakfast'],
  },
  {
    id: 'peanut-butter',
    name: 'Peanut butter',
    caloriesPer100g: 588, proteinPer100g: 25.1, carbsPer100g: 19.6, fatPer100g: 50.4,
    tag: 'fat', diets: ALL, baseGrams: 20, minGrams: 10, maxGrams: 45,
    allergens: ['peanut', 'nuts'], meals: ['breakfast', 'snack'],
  },
  {
    id: 'olive-oil',
    name: 'Olive oil',
    caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100,
    tag: 'fat', diets: ALL, baseGrams: 10, minGrams: 5, maxGrams: 25,
    allergens: [], meals: ['lunch', 'dinner'],
  },
  {
    id: 'avocado',
    name: 'Avocado',
    caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7,
    tag: 'fat', diets: ALL, baseGrams: 70, minGrams: 40, maxGrams: 140,
    allergens: [], meals: ['breakfast', 'snack'],
  },
  {
    id: 'banana',
    name: 'Banana',
    caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
    tag: 'fruit', diets: ALL, baseGrams: 120, minGrams: 80, maxGrams: 200,
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
    id: 'berries',
    name: 'Mixed berries',
    caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14, fatPer100g: 0.3,
    tag: 'fruit', diets: ALL, baseGrams: 120, minGrams: 80, maxGrams: 200,
    allergens: [], meals: ['breakfast', 'snack'],
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
