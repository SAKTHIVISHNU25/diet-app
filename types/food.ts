/** Nutrition per 100 g — the canonical internal shape for any food source. */
export interface NutritionPer100g {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/** A normalized food from USDA, the local cache, or manual entry. */
export interface FoodItem extends NutritionPer100g {
  /** USDA FoodData Central id, when the item came from USDA. */
  fdcId?: string;
  name: string;
  brand?: string;
  source: NutritionSource;
  /** Serving size reported by the source, in grams, when available. */
  servingSizeGrams?: number;
  servingSizeLabel?: string;
}

/**
 * `local` is the curated Indian food table in `lib/nutrition/local-foods.ts`,
 * which is preferred over USDA for the dishes it covers.
 */
export type NutritionSource = 'usda' | 'manual' | 'cache' | 'estimate' | 'local';

/** Absolute nutrition for a concrete portion. */
export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * A candidate food shown on the scan review screen, before the user saves it.
 * This is the hand-off point between recognition and logging — everything here
 * is editable by the user.
 */
export interface FoodCandidate {
  /** Client-side id, so the review list can be keyed and edited. */
  id: string;
  name: string;
  quantity?: number;
  grams: number;
  /** Vision model confidence 0–1. Absent for manually added foods. */
  confidence?: number;
  /** Free-text portion description, when the source provides one. */
  estimatedPortion?: string;
  nutrition: NutritionPer100g | null;
  source: NutritionSource;
  fdcId?: string;
  /** True when nutrition lookup failed and the user must pick a food. */
  needsNutrition: boolean;
}
