import type { GoalType } from '@/types/user';

/** Energy density used to convert grams of macronutrient to calories (Atwater factors). */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Protein target in grams per kg of bodyweight.
 *
 * Higher protein while cutting helps preserve lean mass; a moderate surplus is
 * used for gaining. These sit inside the 1.2–2.2 g/kg range generally cited for
 * active adults (Jäger et al., ISSN position stand, 2017).
 */
export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose_weight: 1.8,
  maintain_weight: 1.6,
  gain_weight: 1.8,
};

/** Share of total calories allocated to fat before carbs take the remainder. */
export const FAT_CALORIE_SHARE = 0.27;

export interface MacroInput {
  calorieTarget: number;
  weightKg: number;
  goal: GoalType;
}

export interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Split a calorie target into protein / carbs / fat.
 *
 * Order of operations:
 *   1. Protein is set from bodyweight (the anchor — it is the macro with the
 *      strongest evidence for a bodyweight-scaled target).
 *   2. Fat takes a fixed share of total calories, with a floor of 0.5 g/kg so
 *      the target never drops into a range that risks essential fatty acid and
 *      fat-soluble vitamin intake.
 *   3. Carbs absorb whatever calories remain.
 *
 * If protein + fat alone would exceed the calorie target (possible for a heavy
 * user on an aggressive deficit), protein is scaled back so carbs never go
 * negative and the three macros always reconcile to the target.
 */
export function calculateMacros({
  calorieTarget,
  weightKg,
  goal,
}: MacroInput): MacroTargets {
  const fatFloorGrams = 0.5 * weightKg;
  const fatFromShare = (calorieTarget * FAT_CALORIE_SHARE) / KCAL_PER_GRAM.fat;
  let fat_g = Math.max(fatFloorGrams, fatFromShare);

  let protein_g = PROTEIN_G_PER_KG[goal] * weightKg;

  let proteinCals = protein_g * KCAL_PER_GRAM.protein;
  let fatCals = fat_g * KCAL_PER_GRAM.fat;

  // Reserve at least 10% of calories for carbohydrate.
  const carbFloorCals = calorieTarget * 0.1;

  if (proteinCals + fatCals + carbFloorCals > calorieTarget) {
    const available = Math.max(0, calorieTarget - carbFloorCals);
    const scale = proteinCals + fatCals === 0 ? 0 : available / (proteinCals + fatCals);
    protein_g *= scale;
    fat_g *= scale;
    proteinCals = protein_g * KCAL_PER_GRAM.protein;
    fatCals = fat_g * KCAL_PER_GRAM.fat;
  }

  const carbCals = Math.max(0, calorieTarget - proteinCals - fatCals);

  return {
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbCals / KCAL_PER_GRAM.carbs),
    fat_g: Math.round(fat_g),
  };
}

/** Total calories implied by a set of macro grams. */
export function caloriesFromMacros(macros: MacroTargets): number {
  return Math.round(
    macros.protein_g * KCAL_PER_GRAM.protein +
      macros.carbs_g * KCAL_PER_GRAM.carbs +
      macros.fat_g * KCAL_PER_GRAM.fat,
  );
}
