import 'server-only';

import { ServerValue } from 'firebase-admin/database';
import type { FoodItem } from '@/types/food';
import { normalizeFoodQuery } from '@/lib/utils';
import { adminDb, encodeKey, PATHS } from '@/lib/firebase/admin';
import { lookupLocalFood } from '@/lib/nutrition/local-foods';
import { MAX_CANDIDATES, pickBestMatch } from '@/lib/nutrition/match-ai';
import { toNumber } from '@/lib/firebase/converters';
import { searchFoods, UsdaError, isUsdaConfigured } from './client';
import { hasUsableNutrition, normalizeUsdaFood } from './nutrition';
import type { UsdaFood } from './types';

export interface FoodSearchResult {
  items: FoodItem[];
  source: 'usda' | 'cache' | 'local';
  degraded?: boolean;
}

/**
 * Search for a food.
 *
 *   1. Curated local table — Indian dishes USDA reports poorly. Wins outright
 *      for a single-result lookup; heads the list for a multi-result search.
 *   2. Exact cache hit on the normalized query — instant, no network.
 *   3. USDA FoodData Central.
 *   4. On USDA failure, a scan of the cache so the app stays usable.
 *
 * The cache lives at `food_cache/{queryKey}`. A miss is never an error.
 *
 * The curated table is checked ahead of the cache on purpose: a cache entry is
 * a previously returned USDA row, so consulting it first would keep serving the
 * value the curated entry exists to replace.
 */
export async function searchFood(query: string, limit = 10): Promise<FoodSearchResult> {
  const normalized = normalizeFoodQuery(query);
  if (!normalized) return { items: [], source: 'cache' };

  const local = lookupLocalFood(normalized);

  // A single-result lookup is the "just give me the nutrition" path used by the
  // scan review screen. A curated hit there is the answer; skip the network.
  if (local && limit <= 1) return { items: [local], source: 'local' };

  const cached = await readCache(normalized);
  if (cached) {
    return local
      ? { items: [local, cached], source: 'local' }
      : { items: [cached], source: 'cache' };
  }

  if (!isUsdaConfigured()) {
    const fuzzy = await scanCache(normalized, limit);
    return local
      ? { items: [local, ...fuzzy].slice(0, limit), source: 'local' }
      : { items: fuzzy, source: 'cache', degraded: true };
  }

  // The auto-lookup path takes whatever comes back first, so it is the one
  // worth spending an AI call on. The search dialog shows a list the user picks
  // from, and does not need one.
  const disambiguate = limit <= 1 && !local;

  try {
    const foods = await searchFoods(query, disambiguate ? MAX_CANDIDATES : limit * 2);
    let items = rankResults(foods, query)
      .map(normalizeUsdaFood)
      .filter(hasUsableNutrition);

    if (disambiguate) {
      const picked = await pickBestMatch(query, items.slice(0, MAX_CANDIDATES));
      // Promote rather than replace, so the keyword order survives underneath.
      if (picked != null && picked > 0) {
        items = [items[picked]!, ...items.filter((_, i) => i !== picked)];
      }
    }

    items = items.slice(0, local ? limit - 1 : limit);

    const best = items[0];
    if (best) void writeCache(normalized, best);

    // The curated entry leads so it is what the review screen picks up, but the
    // USDA rows stay visible for a user who wants a different match.
    return local
      ? { items: [local, ...items], source: 'local' }
      : { items, source: 'usda' };
  } catch (error) {
    if (!(error instanceof UsdaError)) throw error;
    console.warn(`[usda:search] ${error.kind}: falling back to cache`);
    const fuzzy = await scanCache(normalized, limit);
    if (local) return { items: [local, ...fuzzy].slice(0, limit), source: 'local' };
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

    total += DATA_TYPE_WEIGHTS[food.dataType ?? ''] ?? 0;

    const description = normalizeFoodQuery(food.description ?? '');
    if (description === normalizedQuery) total += 50;
    else if (description.startsWith(normalizedQuery)) total += 25;

    const matched = queryWords.filter((word) => description.includes(word)).length;
    total += matched * 5;

    // Penalise words the description adds that the user did not ask for. A
    // plain word costs a little (it is usually a harmless qualifier like
    // "raw"); a word that names a processed or derived form costs a lot.
    //
    // This is what separates "Carrots, raw" from "Carrot, dehydrated". Both are
    // SR Legacy, both start with the query, both match one word — without this
    // they tie, and a stable sort then hands the win to whichever USDA happened
    // to list first. Dehydrated carrot is 341 kcal and 8.1 g protein per 100 g
    // against raw carrot's 41 kcal and 0.93 g, so losing that tie is an
    // eight-fold error in every macro.
    //
    // The penalty only applies to words absent from the query, so searching
    // "carrot juice" or "dosa mix" still finds those products.
    const queryWordSet = new Set(queryWords);
    let extraWordPenalty = 0;
    let formPenalty = 0;

    for (const word of description.split(' ').filter(Boolean)) {
      if (queryWordSet.has(word) || STOPWORDS.has(word)) continue;
      if (PROCESSED_FORM_WORDS.has(word)) formPenalty += 30;
      else if (DERIVED_FORM_WORDS.has(word)) formPenalty += 12;
      else if (PREPARATION_WORDS.has(word)) formPenalty += 8;
      else extraWordPenalty += 4;
    }

    // Cap the generic part so a long but accurate description is not buried;
    // the form penalties are deliberately uncapped.
    total -= Math.min(20, extraWordPenalty) + formPenalty;

    return total;
  }
}

/**
 * Data type weight, wide enough that curated data beats a Branded row even when
 * the branded description matches the query exactly.
 *
 * The old weights ran 40/30/20/10, which the +50 exact-description bonus could
 * overturn on its own: a Branded product named exactly "Banana" (312 kcal,
 * 12.5 g protein per 100 g — banana chips or a flavoured bar) scored 60 and beat
 * SR Legacy's "Bananas, raw" on 56. Branded entries are one manufacturer's
 * product, so they should only win when the user names that product.
 */
const DATA_TYPE_WEIGHTS: Record<string, number> = {
  Foundation: 60,
  'SR Legacy': 50,
  'Survey (FNDDS)': 45,
  Branded: 0,
};

/** Words that carry no signal either way. */
const STOPWORDS = new Set([
  'and', 'or', 'with', 'in', 'of', 'the', 'a', 'on', 'as', 'from', 'to',
]);

/**
 * Concentrated or reconstituted forms. Per-100 g values for these are several
 * times the fresh food's, because the water is gone.
 */
const PROCESSED_FORM_WORDS = new Set([
  'dehydrated', 'dried', 'powder', 'powdered', 'concentrate', 'concentrated',
  'mix', 'instant', 'flour', 'extract', 'isolate', 'syrup', 'freeze',
  'granules', 'paste',
]);

/**
 * Storage and preparation states. Nutritionally close to the plain food, but a
 * user who typed "carrot" did not mean "frozen, unprepared" — these lose to the
 * plain entry without being pushed far down the list.
 */
const PREPARATION_WORDS = new Set([
  'frozen', 'canned', 'unprepared', 'glazed', 'creamed', 'breaded', 'battered',
  'restaurant', 'fastfood',
]);

/** Different foods made *from* the queried food, rather than the food itself. */
const DERIVED_FORM_WORDS = new Set([
  'juice', 'cake', 'cupcake', 'muffin', 'pie', 'bread', 'chips', 'crisps',
  'candy', 'candied', 'sauce', 'soup', 'salad', 'smoothie', 'bar', 'babyfood',
  'baby', 'toddler', 'infant', 'supplement', 'pudding', 'jam', 'pickle',
  'sweetened', 'sugared', 'crystallized',
]);

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
