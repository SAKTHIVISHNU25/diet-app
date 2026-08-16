import 'server-only';

import type { DayTotals, FoodLog, MealType } from '@/types/meal';
import type { NutritionSource } from '@/types/food';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { getUserId } from '@/lib/firebase/server';
import { sumNutrition } from '@/lib/calculations/nutrition';
import {
  toEntries,
  toISOString,
  toNullableNumber,
  toNumber,
  toStringOrNull,
} from '@/lib/firebase/converters';
import { addDays, toISODate } from '@/lib/utils';

/**
 * Food log reads.
 *
 * Logs live under `food_logs/{uid}`, so a query is already scoped to the user
 * by its path. `orderByChild('log_date')` needs `.indexOn: ["log_date"]` in
 * database.rules.json — without it results are still correct, just sorted
 * client-side with a performance warning.
 */

/** All of the signed-in user's logs for one date, oldest first. */
export async function getLogsForDate(date: string): Promise<FoodLog[]> {
  const uid = await getUserId();
  if (!uid) return [];

  try {
    const snapshot = await adminDb()
      .ref(PATHS.foodLogs(uid))
      .orderByChild('log_date')
      .equalTo(date)
      .get();

    return toEntries(snapshot.val())
      .map(({ id, data }) => normalizeFoodLog(id, uid, data))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch (error) {
    console.error('[data:getLogsForDate]', error);
    return [];
  }
}

export async function getDayTotals(date: string): Promise<DayTotals> {
  return sumNutrition(await getLogsForDate(date));
}

/** Recent logs grouped by date, newest date first. Used by /history. */
export async function getRecentLogsByDate(
  days = 14,
): Promise<{ date: string; logs: FoodLog[]; totals: DayTotals }[]> {
  const uid = await getUserId();
  if (!uid) return [];

  const since = toISODate(addDays(new Date(), -days));

  try {
    const snapshot = await adminDb()
      .ref(PATHS.foodLogs(uid))
      .orderByChild('log_date')
      .startAt(since)
      .get();

    const grouped = new Map<string, FoodLog[]>();

    for (const { id, data } of toEntries(snapshot.val())) {
      const log = normalizeFoodLog(id, uid, data);
      const bucket = grouped.get(log.log_date);
      if (bucket) bucket.push(log);
      else grouped.set(log.log_date, [log]);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, logs]) => ({
        date,
        logs: logs.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        totals: sumNutrition(logs),
      }));
  } catch (error) {
    console.error('[data:getRecentLogsByDate]', error);
    return [];
  }
}

export async function getDailyCalorieHistory(
  days = 30,
): Promise<{ date: string; calories: number }[]> {
  const grouped = await getRecentLogsByDate(days);
  return grouped
    .map(({ date, totals }) => ({ date, calories: totals.calories }))
    .reverse();
}

/** `user_id` is implied by the path, so it is passed in rather than stored. */
export function normalizeFoodLog(id: string, uid: string, data: unknown): FoodLog {
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id,
    user_id: uid,
    log_date: String(row.log_date ?? ''),
    meal_type: (row.meal_type as MealType) ?? 'other',
    food_name: String(row.food_name ?? ''),
    quantity: toNumber(row.quantity, 1),
    grams: toNumber(row.grams),
    calories: toNumber(row.calories),
    protein_g: toNumber(row.protein_g),
    carbs_g: toNumber(row.carbs_g),
    fat_g: toNumber(row.fat_g),
    image_url: toStringOrNull(row.image_url),
    nutrition_source: (row.nutrition_source as NutritionSource) ?? 'manual',
    fdc_id: toStringOrNull(row.fdc_id),
    confidence: toNullableNumber(row.confidence),
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}
