import 'server-only';

import type { ProgressSummary, WeightEntry } from '@/types/progress';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { getUserId } from '@/lib/firebase/server';
import {
  toEntries,
  toISOString,
  toNumber,
  toStringOrNull,
} from '@/lib/firebase/converters';

/**
 * Weigh-ins live at `weight_entries/{uid}/{YYYY-MM-DD}` — the date IS the key,
 * which gives "one entry per user per day" for free and sorts chronologically
 * without an index.
 */
export async function getWeightEntries(): Promise<WeightEntry[]> {
  const uid = await getUserId();
  if (!uid) return [];

  try {
    const snapshot = await adminDb().ref(PATHS.weightEntries(uid)).get();

    return toEntries(snapshot.val())
      .map(({ id, data }) => normalizeWeightEntry(id, uid, data))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  } catch (error) {
    console.error('[data:getWeightEntries]', error);
    return [];
  }
}

/**
 * Summarise weight progress. When no weigh-in exists yet, the profile weight
 * stands in for both start and current so the UI still has something to show.
 */
export function summarizeProgress(
  entries: WeightEntry[],
  profileWeight: number,
  goalWeight: number | null,
): ProgressSummary {
  const first = entries[0];
  const last = entries[entries.length - 1];

  const startingWeight = first?.weight_kg ?? profileWeight;
  const currentWeight = last?.weight_kg ?? profileWeight;

  return {
    startingWeight,
    currentWeight,
    goalWeight,
    change: round1(currentWeight - startingWeight),
    toGoal: goalWeight == null ? null : round1(goalWeight - currentWeight),
    entryCount: entries.length,
  };
}

/** The node key is the date, so it doubles as the entry id. */
export function normalizeWeightEntry(
  id: string,
  uid: string,
  data: unknown,
): WeightEntry {
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id,
    user_id: uid,
    entry_date: String(row.entry_date ?? id),
    weight_kg: toNumber(row.weight_kg),
    note: toStringOrNull(row.note),
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
