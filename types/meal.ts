import type { NutritionSource } from './food';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';

export const MEAL_TYPES: MealType[] = [
  'breakfast',
  'lunch',
  'snack',
  'dinner',
  'other',
];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  other: 'Other',
};

/** A row in `food_logs`. */
export interface FoodLog {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType;
  food_name: string;
  quantity: number;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  nutrition_source: NutritionSource;
  fdc_id: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated totals for a day, used by the dashboard. */
export interface DayTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface DaySummary {
  date: string;
  totals: DayTotals;
  logs: FoodLog[];
}
