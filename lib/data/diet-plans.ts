import 'server-only';

import type { DietPlan, DietPlanMeal, DietPlanWithMeals, PlannedFood } from '@/types/diet-plan';
import type { MealType } from '@/types/meal';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { getUserId } from '@/lib/firebase/server';
import { toEntries, toISOString, toNumber } from '@/lib/firebase/converters';

/** The user's current active plan with all of its meals, or null. */
export async function getActivePlan(): Promise<DietPlanWithMeals | null> {
  const uid = await getUserId();
  if (!uid) return null;

  try {
    const db = adminDb();

    // A user has at most a handful of plans, so the whole node is read and
    // filtered in memory. Realtime Database allows only one orderByChild per
    // query and has no composite indexes.
    const plansSnapshot = await db.ref(PATHS.dietPlans(uid)).get();

    const active = toEntries(plansSnapshot.val())
      .map(({ id, data }) => normalizePlan(id, uid, data))
      .filter((plan) => plan.is_active)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    if (!active) return null;

    const mealsSnapshot = await db
      .ref(PATHS.dietPlanMeals(uid))
      .orderByChild('plan_id')
      .equalTo(active.id)
      .get();

    const meals = toEntries(mealsSnapshot.val())
      .map(({ id, data }) => normalizePlanMeal(id, uid, data))
      .sort((a, b) => a.day_index - b.day_index || a.sort_order - b.sort_order);

    return { ...active, meals };
  } catch (error) {
    console.error('[data:getActivePlan]', error);
    return null;
  }
}

export function normalizePlan(id: string, uid: string, data: unknown): DietPlan {
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id,
    user_id: uid,
    name: String(row.name ?? '7-Day Plan'),
    start_date: String(row.start_date ?? ''),
    calorie_target: toNumber(row.calorie_target),
    protein_target_g: toNumber(row.protein_target_g),
    carbs_target_g: toNumber(row.carbs_target_g),
    fat_target_g: toNumber(row.fat_target_g),
    generator: String(row.generator ?? 'template'),
    is_active: row.is_active === true,
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}

export function normalizePlanMeal(id: string, uid: string, data: unknown): DietPlanMeal {
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id,
    plan_id: String(row.plan_id ?? ''),
    user_id: uid,
    day_index: toNumber(row.day_index),
    meal_type: (row.meal_type as MealType) ?? 'other',
    name: String(row.name ?? ''),
    foods: parseFoods(row.foods),
    calories: toNumber(row.calories),
    protein_g: toNumber(row.protein_g),
    carbs_g: toNumber(row.carbs_g),
    fat_g: toNumber(row.fat_g),
    sort_order: toNumber(row.sort_order),
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}

/**
 * `foods` is stored as a JSON array. Realtime Database preserves arrays of
 * objects but returns a sparse object if an index were ever deleted, so both
 * shapes are handled.
 */
function parseFoods(value: unknown): PlannedFood[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : [];

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      name: String(item.name ?? ''),
      grams: toNumber(item.grams),
      calories: toNumber(item.calories),
      protein_g: toNumber(item.protein_g),
      carbs_g: toNumber(item.carbs_g),
      fat_g: toNumber(item.fat_g),
    }));
}
