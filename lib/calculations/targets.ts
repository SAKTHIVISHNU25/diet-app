import type { NutritionTargets, Profile } from '@/types/user';
import { calculateBMR } from './bmr';
import { calculateMacros } from './macros';
import { calculateCalorieTarget, calculateTDEE } from './tdee';

export type TargetInput = Pick<
  Profile,
  'age' | 'gender' | 'height_cm' | 'weight_kg' | 'activity_level' | 'goal'
>;

/**
 * The full derived target set for a profile: BMR -> TDEE -> calories -> macros.
 * Pure, so the dashboard, diet planner and tests all agree by construction.
 *
 * All values are estimates and are not medical advice.
 */
export function calculateTargets(profile: TargetInput): NutritionTargets {
  const bmr = calculateBMR({
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    gender: profile.gender,
  });

  const tdee = calculateTDEE(bmr, profile.activity_level);
  const calories = calculateCalorieTarget(tdee, profile.goal, profile.gender);
  const macros = calculateMacros({
    calorieTarget: calories,
    weightKg: profile.weight_kg,
    goal: profile.goal,
  });

  return { bmr, tdee, calories, ...macros };
}
