import type { Gender } from '@/types/user';

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
}

/**
 * Basal Metabolic Rate using the Mifflin-St Jeor equation.
 *
 *   men:   10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
 *   women: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
 *
 * Mifflin MD, St Jeor ST, et al. "A new predictive equation for resting energy
 * expenditure in healthy individuals." Am J Clin Nutr. 1990;51(2):241-247.
 *
 * For `other` we use the midpoint of the two sex constants (−78). The equation
 * has no validated non-binary variant, so this is an approximation chosen to
 * avoid forcing a selection; the result is an estimate either way.
 *
 * @returns kcal/day, rounded to the nearest whole calorie. Never below 0.
 */
export function calculateBMR({ weightKg, heightCm, age, gender }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

  const constant = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;

  return Math.max(0, Math.round(base + constant));
}
