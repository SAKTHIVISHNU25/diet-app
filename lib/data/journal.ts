import 'server-only';

import type { JournalEntry, JournalMood, JournalSummary } from '@/types/journal';
import { hasReflection, JOURNAL_MOODS } from '@/types/journal';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { getUserId } from '@/lib/firebase/server';
import { toEntries, toISOString, toStringOrNull } from '@/lib/firebase/converters';
import { decryptRecordSafe } from '@/lib/crypto/record-crypto';
import { addDays, fromISODate, toISODate } from '@/lib/utils';

/**
 * Journal entries live at `journal_entries/{uid}/{YYYY-MM-DD}`, the same shape
 * as weigh-ins: the date IS the key, so "one entry per day" comes for free and
 * writing twice on a date edits that day rather than creating a duplicate.
 */
export async function getJournalEntries(): Promise<JournalEntry[]> {
  const uid = await getUserId();
  if (!uid) return [];

  try {
    const snapshot = await adminDb().ref(PATHS.journalEntries(uid)).get();

    return toEntries(snapshot.val())
      .map(({ id, data }) => normalizeJournalEntry(id, uid, data))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  } catch (error) {
    console.error('[data:getJournalEntries]', error);
    return [];
  }
}

/** The node key is the date, so it doubles as the entry id. */
export function normalizeJournalEntry(
  id: string,
  uid: string,
  data: unknown,
): JournalEntry {
  const row = decryptRecordSafe('journal_entries', uid, id, data);

  return {
    id,
    user_id: uid,
    entry_date: String(row.entry_date ?? id),
    mood: toMood(row.mood),
    content: typeof row.content === 'string' ? row.content : '',
    went_well: toStringOrNull(row.went_well),
    went_wrong: toStringOrNull(row.went_wrong),
    to_improve: toStringOrNull(row.to_improve),
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}

/**
 * Summarise the journal. `entries` may arrive in any order — everything here
 * works off a date set rather than positions in the list.
 */
export function summarizeJournal(
  entries: JournalEntry[],
  today: string = toISODate(),
): JournalSummary {
  const dates = new Set(entries.map((entry) => entry.entry_date));

  const cutoff = toISODate(addDays(fromISODate(today), -29));
  const last30Days = entries.filter((entry) => entry.entry_date >= cutoff).length;

  return {
    entryCount: entries.length,
    streak: countStreak(dates, today),
    last30Days,
    topMood: mostFrequentMood(entries),
    reflectionCount: entries.filter(hasReflection).length,
  };
}

/**
 * Consecutive days written, counting back from today.
 *
 * A day that is not over yet should not break a run, so the count may start at
 * yesterday: someone with a 10-day streak who has not written *this morning*
 * still has a 10-day streak, not zero.
 */
function countStreak(dates: Set<string>, today: string): number {
  const start = fromISODate(today);
  let cursor = dates.has(today) ? start : addDays(start, -1);
  let streak = 0;

  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function mostFrequentMood(entries: JournalEntry[]): JournalMood | null {
  const counts = new Map<JournalMood, number>();

  for (const entry of entries) {
    if (!entry.mood) continue;
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  let top: JournalMood | null = null;
  let best = 0;
  for (const [mood, count] of counts) {
    if (count > best) {
      top = mood;
      best = count;
    }
  }

  return top;
}

function toMood(value: unknown): JournalMood | null {
  return JOURNAL_MOODS.includes(value as JournalMood) ? (value as JournalMood) : null;
}
