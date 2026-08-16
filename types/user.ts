export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active';

export type GoalType = 'lose_weight' | 'maintain_weight' | 'gain_weight';

export type DietaryPreference =
  | 'vegetarian'
  | 'non_vegetarian'
  | 'vegan'
  | 'eggetarian';

export interface Profile {
  id: string;
  full_name: string;
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number | null;
  activity_level: ActivityLevel;
  goal: GoalType;
  dietary_preference: DietaryPreference;
  allergies: string[];
  food_preferences: string[];
  meals_per_day: number;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

/** The derived daily numbers shown on the dashboard. All values are estimates. */
export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
};

export const ACTIVITY_LEVEL_HINTS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, little or no exercise',
  lightly_active: 'Light exercise 1–3 days a week',
  moderately_active: 'Moderate exercise 3–5 days a week',
  very_active: 'Hard exercise 6–7 days a week',
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: 'Lose weight',
  maintain_weight: 'Maintain weight',
  gain_weight: 'Gain weight',
};

export const DIETARY_PREFERENCE_LABELS: Record<DietaryPreference, string> = {
  vegetarian: 'Vegetarian',
  non_vegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
  eggetarian: 'Eggetarian',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};
