import type { NutritionPer100g, NutritionTotals } from '@/types/food';
import type { DayTotals, FoodLog } from '@/types/meal';

/**
 * Scale per-100 g nutrition to a concrete portion.
 *
 *   100 g -> the USDA value as-is
 *   200 g -> the USDA value x 2
 *
 * Results are rounded to 1 decimal place; calories to a whole number, since
 * sub-calorie precision is meaningless against the accuracy of the inputs.
 */
export function calculateNutritionForGrams(
  per100g: NutritionPer100g,
  grams: number,
): NutritionTotals {
  const factor = Math.max(0, grams) / 100;

  return {
    calories: Math.round(per100g.caloriesPer100g * factor),
    protein_g: round1(per100g.proteinPer100g * factor),
    carbs_g: round1(per100g.carbsPer100g * factor),
    fat_g: round1(per100g.fatPer100g * factor),
  };
}

/** Sum a set of food log rows into day totals. */
export function sumNutrition(
  logs: Pick<FoodLog, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[],
): DayTotals {
  const totals = logs.reduce<DayTotals>(
    (acc, log) => ({
      calories: acc.calories + toNumber(log.calories),
      protein_g: acc.protein_g + toNumber(log.protein_g),
      carbs_g: acc.carbs_g + toNumber(log.carbs_g),
      fat_g: acc.fat_g + toNumber(log.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return {
    calories: Math.round(totals.calories),
    protein_g: round1(totals.protein_g),
    carbs_g: round1(totals.carbs_g),
    fat_g: round1(totals.fat_g),
  };
}

/** Remaining calories against a target. Can be negative when over target. */
export function remainingCalories(target: number, consumed: number): number {
  return Math.round(target - consumed);
}

/**
 * Progress toward a target as a percentage, clamped to 0–100 for use in
 * progress bars. Use `rawPercent` when you need to show an over-target value.
 */
export function percentOfTarget(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((consumed / target) * 100)));
}

export function rawPercent(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((consumed / target) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Realtime Database stores plain JSON, so a hand-edited node may hold a
 *  numeric string where a number belongs. Coerce defensively. */
function toNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
