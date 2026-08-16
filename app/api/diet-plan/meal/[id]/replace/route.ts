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
import { toNumber } from '@/lib/firebase/converters';
import { decryptRecord, encryptRecord } from '@/lib/crypto/record-crypto';
import { replacePlanMealSchema } from '@/lib/validations/diet-plan';
import { calculateTargets } from '@/lib/calculations/targets';
import { buildMeal, getMealSplit } from '@/lib/diet/template-planner';
import { filterFoods } from '@/lib/diet/food-database';
import { normalizeProfile } from '@/lib/data/profile';
import { normalizePlanMeal } from '@/lib/data/diet-plans';
import { seededRandom } from '@/lib/utils';
import type { MealType } from '@/types/meal';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/diet-plan/meal/[id]/replace
 *
 * Swaps one meal for a different one built against the SAME calorie and
 * protein share as the slot it replaces, so the day's totals stay close to the
 * user's targets rather than drifting with each swap.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const uid = auth.user.uid;
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      return apiError('not_found', 'That meal no longer exists.');
    }

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = replacePlanMealSchema.safeParse(body ?? {});
    if (!parsed.success) return validationError(parsed.error);

    const db = adminDb();
    const mealRef = db.ref(PATHS.dietPlanMeal(uid, id));
    const mealSnapshot = await mealRef.get();

    if (!mealSnapshot.exists()) {
      return apiError('not_found', 'That meal no longer exists.');
    }

    // `sort_order`, `meal_type` and `day_index` are sealed, so the slot this
    // meal occupies can only be recovered from the unsealed record.
    const existing = decryptRecord('diet_plan_meals', uid, id, mealSnapshot.val());

    const profileSnapshot = await db.ref(PATHS.profile(uid)).get();
    if (!profileSnapshot.exists()) {
      return apiError('missing_profile', 'Complete your profile first.');
    }

    const profile = normalizeProfile(uid, profileSnapshot.val());
    const targets = calculateTargets(profile);

    // Recover this slot's share of the day from the meal split.
    const split = getMealSplit(profile.meals_per_day);
    const sortOrder = toNumber(existing.sort_order);
    const mealType = (existing.meal_type as MealType) ?? 'other';
    const slot =
      split[sortOrder] ?? split.find((s) => s.type === mealType) ?? split[0]!;

    const available = filterFoods(profile.dietary_preference, profile.allergies, []);
    if (available.length === 0) {
      return apiError(
        'no_results',
        'No foods match your dietary preference and allergies.',
      );
    }

    // Offsetting the seed guarantees a different rotation than the current meal.
    const seed = parsed.data.seed ?? Math.floor(Date.now() / 1000) % 1_000_000;
    const random = seededRandom(seed);

    const replacement = buildMeal({
      available,
      liked: new Set(profile.food_preferences.map((p) => p.toLowerCase())),
      mealType,
      targetCalories: Math.round(targets.calories * slot.share),
      targetProtein: Math.round(targets.protein_g * slot.share),
      day: toNumber(existing.day_index),
      slotIndex: sortOrder + seed,
      random,
    });

    // `existing` is already unsealed, so the whole record is resealed in one
    // go rather than read a second time.
    await mealRef.set(
      encryptRecord('diet_plan_meals', uid, id, {
        ...existing,
        name: replacement.name,
        foods: replacement.foods,
        calories: replacement.calories,
        protein_g: replacement.protein_g,
        carbs_g: replacement.carbs_g,
        fat_g: replacement.fat_g,
        updated_at: ServerValue.TIMESTAMP,
      }),
    );

    const updated = await mealRef.get();
    return apiSuccess({ meal: normalizePlanMeal(id, uid, updated.val()) });
  } catch (error) {
    return handleRouteError('diet-plan/replace', error);
  }
}
