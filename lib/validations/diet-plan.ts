import { z } from 'zod';
import { mealTypeSchema } from './food';

export const plannedFoodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.coerce.number().positive().max(5000),
  calories: z.coerce.number().min(0).max(20000),
  protein_g: z.coerce.number().min(0).max(2000),
  carbs_g: z.coerce.number().min(0).max(2000),
  fat_g: z.coerce.number().min(0).max(2000),
});

export type PlannedFoodInput = z.infer<typeof plannedFoodSchema>;

/** Body for POST /api/diet-plan/generate. Everything is derived server-side
 *  from the authenticated user's profile, so the body only carries options. */
export const generatePlanSchema = z.object({
  /** Regenerating replaces the current active plan. */
  replaceActive: z.boolean().default(true),
  /** Optional seed so a regenerate produces a different plan than the last. */
  seed: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

/** Body for PATCH /api/diet-plan/meal/[id] — edit a planned meal in place. */
export const updatePlanMealSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  foods: z.array(plannedFoodSchema).max(12).optional(),
  meal_type: mealTypeSchema.optional(),
});

export type UpdatePlanMealInput = z.infer<typeof updatePlanMealSchema>;

/** Body for POST /api/diet-plan/meal/[id]/replace — swap in a different meal. */
export const replacePlanMealSchema = z.object({
  seed: z.coerce.number().int().min(0).max(1_000_000).optional(),
});
