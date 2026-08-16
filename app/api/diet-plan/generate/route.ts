import type { NextRequest } from 'next/server';
import { ServerValue } from 'firebase-admin/database';
import {
  apiError,
  apiSuccess,
  handleRouteError,
  validationError,
} from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { toEntries } from '@/lib/firebase/converters';
import { encryptRecord } from '@/lib/crypto/record-crypto';
import { generatePlanSchema } from '@/lib/validations/diet-plan';
import { calculateTargets } from '@/lib/calculations/targets';
import { getDietPlanProvider } from '@/lib/diet/provider';
import { normalizeProfile } from '@/lib/data/profile';
import { toISODate } from '@/lib/utils';

/**
 * POST /api/diet-plan/generate
 *
 * Builds a 7-day plan from the signed-in user's profile and stores it.
 * Uses the template planner by default — no AI API key required.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const uid = auth.user.uid;
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = generatePlanSchema.safeParse(body ?? {});
    if (!parsed.success) return validationError(parsed.error);

    const db = adminDb();

    const profileSnapshot = await db.ref(PATHS.profile(uid)).get();
    if (!profileSnapshot.exists()) {
      return apiError(
        'missing_profile',
        'Complete your profile before generating a diet plan.',
      );
    }

    const profile = normalizeProfile(uid, profileSnapshot.val());
    const targets = calculateTargets(profile);

    const provider = getDietPlanProvider();
    const plan = await provider.generatePlan({
      profile,
      targets,
      // Without an explicit seed, vary by day so "regenerate" gives something
      // new while a same-day retry stays stable.
      seed: parsed.data.seed ?? deriveSeed(uid),
    });

    if (plan.meals.length === 0) {
      return apiError(
        'no_results',
        'No suitable foods matched your dietary preference and allergies. Try relaxing one of them.',
      );
    }

    const plansRef = db.ref(PATHS.dietPlans(uid));
    const planId = plansRef.push().key;
    if (!planId) throw new Error('Could not allocate a plan id');

    // Everything below is written in one atomic multi-path update: the new
    // plan, its meals, the deactivation of the previous plan, and the removal
    // of that plan's meals. There is no window in which the user has two
    // active plans, or a plan with no meals.
    const updates: Record<string, unknown> = {};

    const existingPlans = toEntries((await plansRef.get()).val());
    const supersededPlanIds = new Set<string>();

    if (parsed.data.replaceActive) {
      for (const { id, data } of existingPlans) {
        if (data.is_active === true) {
          updates[`${PATHS.dietPlans(uid)}/${id}/is_active`] = false;
          supersededPlanIds.add(id);
        }
      }
    }

    // `is_active` stays in the clear because it is indexed and selects the
    // current plan; the targets, which reveal the user's calorie prescription,
    // are sealed.
    updates[PATHS.dietPlan(uid, planId)] = encryptRecord('diet_plans', uid, planId, {
      name: '7-Day Plan',
      start_date: toISODate(),
      calorie_target: plan.calorieTarget,
      protein_target_g: plan.proteinTargetG,
      carbs_target_g: plan.carbsTargetG,
      fat_target_g: plan.fatTargetG,
      generator: plan.generator,
      is_active: true,
      created_at: ServerValue.TIMESTAMP,
      updated_at: ServerValue.TIMESTAMP,
    });

    // Drop the superseded plans' meals so the database does not accumulate
    // orphaned nodes every time the user regenerates.
    if (supersededPlanIds.size > 0) {
      const existingMeals = toEntries(
        (await db.ref(PATHS.dietPlanMeals(uid)).get()).val(),
      );
      for (const { id, data } of existingMeals) {
        if (supersededPlanIds.has(String(data.plan_id))) {
          updates[PATHS.dietPlanMeal(uid, id)] = null;
        }
      }
    }

    const mealsRef = db.ref(PATHS.dietPlanMeals(uid));
    for (const meal of plan.meals) {
      const mealId = mealsRef.push().key;
      if (!mealId) continue;
      // `plan_id` is the query key for this node, so it stays plaintext — it is
      // an opaque push id and reveals nothing on its own.
      updates[PATHS.dietPlanMeal(uid, mealId)] = encryptRecord(
        'diet_plan_meals',
        uid,
        mealId,
        {
          plan_id: planId,
          day_index: meal.day_index,
          meal_type: meal.meal_type,
          name: meal.name,
          foods: meal.foods,
          calories: meal.calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          sort_order: meal.sort_order,
          created_at: ServerValue.TIMESTAMP,
          updated_at: ServerValue.TIMESTAMP,
        },
      );
    }

    await db.ref().update(updates);

    return apiSuccess({ planId, mealCount: plan.meals.length }, 201);
  } catch (error) {
    return handleRouteError('diet-plan/generate', error);
  }
}

/** A stable-per-user, changes-daily seed. */
function deriveSeed(userId: string): number {
  let hash = 0;
  const source = `${userId}:${toISODate()}`;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 1_000_000;
  }
  return hash;
}
