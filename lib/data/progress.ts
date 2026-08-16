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
import { decryptRecordSafe } from '@/lib/crypto/record-crypto';

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
 * Summarise weight progress.
 *
 * The baseline is the weight captured at onboarding (`starting_weight_kg`),
 * never a weigh-in. Deriving it from the earliest entry made the start move
 * every time someone logged a weight — with a single weigh-in, start and
 * current were the same number and the change was permanently 0.
 *
 * Profiles created before that field existed fall back to the profile weight,
 * which is the onboarding value for anyone who has not edited it since.
 */
export function summarizeProgress(
  entries: WeightEntry[],
  profileWeight: number,
  goalWeight: number | null,
  baselineWeight?: number | null,
): ProgressSummary {
  const last = entries[entries.length - 1];

  const startingWeight = baselineWeight ?? profileWeight;
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
  const row = decryptRecordSafe('weight_entries', uid, id, data);

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
