import type { ActivityLevel, GoalType } from '@/types/user';

/**
 * Physical Activity Level multipliers applied to BMR.
 * These are the widely used Harris-Benedict / Mifflin activity factors.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

/**
 * Total Daily Energy Expenditure = BMR × activity multiplier.
 * @returns kcal/day, rounded.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Calorie adjustment applied to TDEE per goal, in kcal/day.
 *
 * A ~500 kcal/day deficit corresponds to roughly 0.5 kg per week, since ~7700
 * kcal is commonly used as the energy content of 1 kg of body fat. This is a
 * population-level approximation, not a guarantee for any individual.
 */
export const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  lose_weight: -500,
  maintain_weight: 0,
  gain_weight: 350,
};

/**
 * Daily calorie target for a goal.
 *
 * A safety floor is applied so an aggressive deficit can never produce a
 * dangerously low target: 1200 kcal for women/other, 1500 kcal for men. These
 * are the commonly cited minimums for unsupervised dieting. The floor also
 * never exceeds TDEE itself, so very small people are not pushed into a
 * surplus by the floor.
 */
export function calculateCalorieTarget(
  tdee: number,
  goal: GoalType,
  gender: 'male' | 'female' | 'other' = 'other',
): number {
  const adjusted = tdee + GOAL_ADJUSTMENTS[goal];
  const floor = Math.min(gender === 'male' ? 1500 : 1200, tdee);
  return Math.round(Math.max(adjusted, floor));
}
