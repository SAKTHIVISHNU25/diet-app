import type { MealType } from '@/types/meal';
import type { PlannedFood } from '@/types/diet-plan';
import type { Profile } from '@/types/user';
import { seededRandom } from '@/lib/utils';
import { filterFoods, type PlannerFood } from './food-database';
import type { GeneratedMeal, GeneratedPlan, PlanGenerationInput } from './types';

/**
 * Deterministic 7-day meal planner.
 *
 * Runs entirely offline with no AI API and no network access, so the core diet
 * feature never depends on a paid service. Given the same profile and seed it
 * always produces the same plan.
 *
 * Approach, per meal:
 *   1. Split the day's calorie and protein targets across the user's meals.
 *   2. Pick a protein, a carbohydrate and a vegetable (rotated by day so the
 *      week has variety and no food repeats on consecutive days).
 *   3. Size the protein portion to hit the meal's protein target, then let the
 *      carbohydrate absorb the remaining calories, then top up with a fat if
 *      the meal still falls short.
 *   4. Clamp every portion to the food's sensible min/max, so the planner never
 *      suggests 700 g of chicken or 5 g of rice.
 *
 * Because portions are clamped, a meal can land short of or over its target.
 * That is intentional — a realistic portion matters more than hitting a number.
 */

/** Share of daily calories per meal, keyed by number of meals per day. */
const MEAL_SPLITS: Record<number, { type: MealType; share: number }[]> = {
  2: [
    { type: 'lunch', share: 0.5 },
    { type: 'dinner', share: 0.5 },
  ],
  3: [
    { type: 'breakfast', share: 0.3 },
    { type: 'lunch', share: 0.4 },
    { type: 'dinner', share: 0.3 },
  ],
  4: [
    { type: 'breakfast', share: 0.25 },
    { type: 'lunch', share: 0.35 },
    { type: 'snack', share: 0.1 },
    { type: 'dinner', share: 0.3 },
  ],
  5: [
    { type: 'breakfast', share: 0.22 },
    { type: 'snack', share: 0.1 },
    { type: 'lunch', share: 0.31 },
    { type: 'snack', share: 0.1 },
    { type: 'dinner', share: 0.27 },
  ],
  6: [
    { type: 'breakfast', share: 0.2 },
    { type: 'snack', share: 0.09 },
    { type: 'lunch', share: 0.28 },
    { type: 'snack', share: 0.09 },
    { type: 'dinner', share: 0.25 },
    { type: 'snack', share: 0.09 },
  ],
};

export function getMealSplit(mealsPerDay: number) {
  return MEAL_SPLITS[mealsPerDay] ?? MEAL_SPLITS[4]!;
}

export type PlannerProfile = Pick<
  Profile,
  'dietary_preference' | 'allergies' | 'food_preferences' | 'meals_per_day'
>;

export function generateTemplatePlan(input: PlanGenerationInput): GeneratedPlan {
  const { profile, targets, seed = 1 } = input;
  const random = seededRandom(seed);

  const available = filterFoods(
    profile.dietary_preference,
    profile.allergies,
    // `food_preferences` are treated as likes; they bias selection rather than
    // exclude, so they are not passed as dislikes here.
    [],
  );

  const liked = new Set(profile.food_preferences.map((p) => p.toLowerCase()));
  const split = getMealSplit(profile.meals_per_day);
  const meals: GeneratedMeal[] = [];

  for (let day = 0; day < 7; day += 1) {
    split.forEach((slot, index) => {
      meals.push(
        buildMeal({
          available,
          liked,
          mealType: slot.type,
          targetCalories: Math.round(targets.calories * slot.share),
          targetProtein: Math.round(targets.protein_g * slot.share),
          day,
          slotIndex: index,
          random,
        }),
      );
    });
  }

  return {
    generator: 'template',
    calorieTarget: targets.calories,
    proteinTargetG: targets.protein_g,
    carbsTargetG: targets.carbs_g,
    fatTargetG: targets.fat_g,
    meals,
  };
}

interface BuildMealArgs {
  available: PlannerFood[];
  liked: Set<string>;
  mealType: MealType;
  targetCalories: number;
  targetProtein: number;
  day: number;
  slotIndex: number;
  random: () => number;
}

/**
 * Builds a single meal. Exported so "replace this meal" can regenerate one
 * slot without rebuilding the whole plan.
 */
export function buildMeal({
  available,
  liked,
  mealType,
  targetCalories,
  targetProtein,
  day,
  slotIndex,
  random,
}: BuildMealArgs): GeneratedMeal {
  const slotFoods = available.filter((food) =>
    food.meals.includes(mealType === 'other' ? 'snack' : mealType),
  );

  const proteins = pickPool(slotFoods, ['protein', 'dairy']);
  const carbs = pickPool(slotFoods, ['carb', 'fruit']);
  const vegetables = pickPool(slotFoods, ['vegetable']);
  const fats = pickPool(slotFoods, ['fat']);

  // Rotate by day so the week varies and the same food does not land on
  // consecutive days, while staying deterministic for a given seed.
  const rotation = day * 3 + slotIndex + Math.floor(random() * 3);

  const protein = rotate(proteins, rotation, liked);
  const carb = rotate(carbs, rotation + 1, liked);
  const vegetable = rotate(vegetables, rotation + 2, liked);
  const fat = rotate(fats, rotation, liked);

  const foods: PlannedFood[] = [];
  let caloriesUsed = 0;

  // 1. Protein sized to the meal's protein target.
  if (protein) {
    const grams = clampGrams(
      protein,
      targetProtein > 0 && protein.proteinPer100g > 0
        ? (targetProtein / protein.proteinPer100g) * 100
        : protein.baseGrams,
    );
    foods.push(toPlannedFood(protein, grams));
    caloriesUsed += (protein.caloriesPer100g * grams) / 100;
  }

  // 2. Vegetables at their standard serving — they add volume, not calories.
  if (vegetable && mealType !== 'snack') {
    const grams = clampGrams(vegetable, vegetable.baseGrams);
    foods.push(toPlannedFood(vegetable, grams));
    caloriesUsed += (vegetable.caloriesPer100g * grams) / 100;
  }

  // 3. Carbohydrate absorbs the remaining calories.
  if (carb) {
    const remaining = Math.max(0, targetCalories - caloriesUsed);
    const grams = clampGrams(
      carb,
      carb.caloriesPer100g > 0 ? (remaining / carb.caloriesPer100g) * 100 : carb.baseGrams,
    );
    foods.push(toPlannedFood(carb, grams));
    caloriesUsed += (carb.caloriesPer100g * grams) / 100;
  }

  // 4. Top up with a fat source if the meal is still meaningfully short.
  const shortfall = targetCalories - caloriesUsed;
  if (fat && shortfall > 60) {
    const grams = clampGrams(
      fat,
      fat.caloriesPer100g > 0 ? (shortfall / fat.caloriesPer100g) * 100 : fat.baseGrams,
    );
    foods.push(toPlannedFood(fat, grams));
    caloriesUsed += (fat.caloriesPer100g * grams) / 100;
  }

  const totals = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein_g: acc.protein_g + food.protein_g,
      carbs_g: acc.carbs_g + food.carbs_g,
      fat_g: acc.fat_g + food.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return {
    day_index: day,
    meal_type: mealType,
    name: buildMealName(foods),
    foods,
    calories: Math.round(totals.calories),
    protein_g: round1(totals.protein_g),
    carbs_g: round1(totals.carbs_g),
    fat_g: round1(totals.fat_g),
    sort_order: slotIndex,
  };
}

function pickPool(foods: PlannerFood[], tags: PlannerFood['tag'][]): PlannerFood[] {
  return foods.filter((food) => tags.includes(food.tag));
}

/**
 * Deterministically choose from a pool, preferring foods the user listed as a
 * preference. Returns null for an empty pool (possible when allergies exclude
 * every option in a category).
 */
function rotate(
  pool: PlannerFood[],
  offset: number,
  liked: Set<string>,
): PlannerFood | null {
  if (pool.length === 0) return null;

  const preferred = pool.filter((food) =>
    Array.from(liked).some((like) => food.name.toLowerCase().includes(like)),
  );

  const source = preferred.length > 0 ? preferred : pool;
  return source[Math.abs(offset) % source.length] ?? null;
}

/** Round to the nearest 5 g and keep within the food's sensible bounds. */
function clampGrams(food: PlannerFood, grams: number): number {
  const bounded = Math.min(food.maxGrams, Math.max(food.minGrams, grams));
  return Math.max(5, Math.round(bounded / 5) * 5);
}

function toPlannedFood(food: PlannerFood, grams: number): PlannedFood {
  const factor = grams / 100;
  return {
    name: food.name,
    grams,
    calories: Math.round(food.caloriesPer100g * factor),
    protein_g: round1(food.proteinPer100g * factor),
    carbs_g: round1(food.carbsPer100g * factor),
    fat_g: round1(food.fatPer100g * factor),
  };
}

function buildMealName(foods: PlannedFood[]): string {
  if (foods.length === 0) return 'No suitable foods found';
  const names = foods.slice(0, 2).map((f) => f.name);
  const base = names.join(' with ');
  return foods.length > 2 ? `${base} +${foods.length - 2}` : base;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
