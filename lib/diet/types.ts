import type { PlannedFood } from '@/types/diet-plan';
import type { MealType } from '@/types/meal';
import type { NutritionTargets, Profile } from '@/types/user';

/** A meal produced by a planner, before it is persisted. */
export interface GeneratedMeal {
  day_index: number;
  meal_type: MealType;
  name: string;
  foods: PlannedFood[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
}

export interface GeneratedPlan {
  generator: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  /** 7 days x meals-per-day entries. */
  meals: GeneratedMeal[];
}

export type PlannerProfileInput = Pick<
  Profile,
  'dietary_preference' | 'allergies' | 'food_preferences' | 'meals_per_day' | 'goal'
>;

export interface PlanGenerationInput {
  profile: PlannerProfileInput;
  targets: NutritionTargets;
  /** Deterministic seed. The same seed yields the same plan. */
  seed?: number;
}

/**
 * A diet plan generator. The template implementation is the default and needs
 * no API key; an AI-backed implementation can be added later without touching
 * any calling code.
 */
export interface DietPlanProvider {
  readonly name: string;
  generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan>;
}
