import type { PlannedFood } from '@/types/diet-plan';

/**
 * Sum a list of planned foods into meal totals.
 *
 * Lives here rather than in a route module so both the diet-plan routes and
 * the planner can use it — and because Next.js route files may only export
 * request handlers.
 */
export function totalsFor(foods: Pick<PlannedFood, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]) {
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
    calories: Math.round(totals.calories),
    protein_g: round1(totals.protein_g),
    carbs_g: round1(totals.carbs_g),
    fat_g: round1(totals.fat_g),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
