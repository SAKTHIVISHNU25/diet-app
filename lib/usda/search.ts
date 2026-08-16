import 'server-only';

import { ServerValue } from 'firebase-admin/database';
import type { FoodItem } from '@/types/food';
import { normalizeFoodQuery } from '@/lib/utils';
import { adminDb, encodeKey, PATHS } from '@/lib/firebase/admin';
import { toNumber } from '@/lib/firebase/converters';
import { searchFoods, UsdaError, isUsdaConfigured } from './client';
import { hasUsableNutrition, normalizeUsdaFood } from './nutrition';
import { PREFERRED_DATA_TYPES, type UsdaFood } from './types';

export interface FoodSearchResult {
  items: FoodItem[];
  source: 'usda' | 'cache';
  degraded?: boolean;
}

/**
 * Search for a food.
 *
 *   1. Exact cache hit on the normalized query — instant, no network.
 *   2. USDA FoodData Central.
 *   3. On USDA failure, a scan of the cache so the app stays usable.
 *
 * The cache lives at `food_cache/{queryKey}`. A miss is never an error.
 */
export async function searchFood(query: string, limit = 10): Promise<FoodSearchResult> {
  const normalized = normalizeFoodQuery(query);
  if (!normalized) return { items: [], source: 'cache' };

  const cached = await readCache(normalized);
  if (cached) return { items: [cached], source: 'cache' };

  if (!isUsdaConfigured()) {
    const fuzzy = await scanCache(normalized, limit);
    return { items: fuzzy, source: 'cache', degraded: true };
  }

  try {
    const foods = await searchFoods(query, limit * 2);
    const items = rankResults(foods, query)
      .map(normalizeUsdaFood)
      .filter(hasUsableNutrition)
      .slice(0, limit);

    const best = items[0];
    if (best) void writeCache(normalized, best);

    return { items, source: 'usda' };
  } catch (error) {
    if (!(error instanceof UsdaError)) throw error;
    console.warn(`[usda:search] ${error.kind}: falling back to cache`);
    const fuzzy = await scanCache(normalized, limit);
    if (fuzzy.length > 0) return { items: fuzzy, source: 'cache', degraded: true };
    throw error;
  }
}

/**
 * Rank USDA results so the most useful entry wins. USDA relevance alone tends
 * to surface branded variants ahead of the plain food.
 */
export function rankResults(foods: UsdaFood[], query: string): UsdaFood[] {
  const normalizedQuery = normalizeFoodQuery(query);
  const queryWords = normalizedQuery.split(' ').filter(Boolean);

  return [...foods].sort((a, b) => score(b) - score(a));

  function score(food: UsdaFood): number {
    let total = 0;

    const dataTypeIndex = PREFERRED_DATA_TYPES.indexOf(
      (food.dataType ?? '') as (typeof PREFERRED_DATA_TYPES)[number],
    );
    total += dataTypeIndex === -1 ? 0 : (PREFERRED_DATA_TYPES.length - dataTypeIndex) * 10;

    const description = normalizeFoodQuery(food.description ?? '');
    if (description === normalizedQuery) total += 50;
    else if (description.startsWith(normalizedQuery)) total += 25;

    const matched = queryWords.filter((word) => description.includes(word)).length;
    total += matched * 5;

    // Shorter descriptions are usually the plain ingredient rather than a
    // composite dish, which is the better default for portion-based tracking.
    total -= Math.min(20, description.split(' ').length);

    return total;
  }
}

/** Exact cache lookup by normalized query key. */
async function readCache(queryKey: string): Promise<FoodItem | null> {
  try {
    const ref = adminDb().ref(PATHS.foodCacheEntry(queryKey));
    const snapshot = await ref.get();
    if (!snapshot.exists()) return null;

    // Best-effort hit counter; failure here must not affect the lookup.
    void ref.child('hit_count').set(ServerValue.increment(1));

    return cacheNodeToFoodItem(snapshot.val());
  } catch (error) {
    console.warn('[usda:cache] read failed', error);
    return null;
  }
}

/**
 * Substring search over the cache, used when USDA is unavailable. Realtime
 * Database has no `contains` operator, so this filters in memory — acceptable
 * because the cache is small and this path only runs after USDA has failed.
 */
async function scanCache(queryKey: string, limit: number): Promise<FoodItem[]> {
  try {
    const snapshot = await adminDb().ref(PATHS.foodCache).get();
    const value = snapshot.val();
    if (!value || typeof value !== 'object') return [];

    const words = queryKey.split(' ').filter(Boolean);

    return Object.values(value as Record<string, unknown>)
      .filter(
        (node): node is Record<string, unknown> =>
          typeof node === 'object' && node !== null,
      )
      .filter((node) => {
        const name = String(node.name ?? '').toLowerCase();
        return words.some((word) => name.includes(word));
      })
      .slice(0, limit)
      .map(cacheNodeToFoodItem);
  } catch (error) {
    console.warn('[usda:cache] scan failed', error);
    return [];
  }
}

async function writeCache(queryKey: string, item: FoodItem): Promise<void> {
  try {
    await adminDb()
      .ref(PATHS.foodCacheEntry(queryKey))
      .update({
        query_key: queryKey,
        fdc_id: item.fdcId ?? null,
        name: item.name,
        brand: item.brand ?? null,
        calories_per_100g: item.caloriesPer100g,
        protein_per_100g: item.proteinPer100g,
        carbs_per_100g: item.carbsPer100g,
        fat_per_100g: item.fatPer100g,
        source: 'usda',
        updated_at: ServerValue.TIMESTAMP,
      });
  } catch (error) {
    console.warn('[usda:cache] write failed', error);
  }
}

function cacheNodeToFoodItem(node: unknown): FoodItem {
  const row = (node ?? {}) as Record<string, unknown>;

  return {
    fdcId: typeof row.fdc_id === 'string' ? row.fdc_id : undefined,
    name: String(row.name ?? ''),
    brand: typeof row.brand === 'string' ? row.brand : undefined,
    source: 'cache',
    caloriesPer100g: toNumber(row.calories_per_100g),
    proteinPer100g: toNumber(row.protein_per_100g),
    carbsPer100g: toNumber(row.carbs_per_100g),
    fatPer100g: toNumber(row.fat_per_100g),
  };
}

export { encodeKey };
