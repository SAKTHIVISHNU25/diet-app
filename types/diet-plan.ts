import type { MealType } from './meal';

/** One food inside a planned meal. Stored as JSONB in diet_plan_meals.foods. */
export interface PlannedFood {
  name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface DietPlanMeal {
  id: string;
  plan_id: string;
  user_id: string;
  day_index: number;
  meal_type: MealType;
  name: string;
  foods: PlannedFood[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DietPlan {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  generator: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DietPlanWithMeals extends DietPlan {
  meals: DietPlanMeal[];
}

export const DAY_NAMES = [
  'Day 1',
  'Day 2',
  'Day 3',
  'Day 4',
  'Day 5',
  'Day 6',
  'Day 7',
] as const;
