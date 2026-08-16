import type { JournalEntry, JournalMood } from '@/types/journal';
import { JOURNAL_MOODS, REFLECTION_FIELDS } from '@/types/journal';
import { addDays, toISODate } from '@/lib/utils';

export interface JournalDay {
  date: string;
  entry: JournalEntry | null;
  isToday: boolean;
}

/**
 * The last `count` days, oldest first, each carrying its entry if there is one.
 *
 * Built from a date walk rather than from the entries themselves, because the
 * *gaps* are the point: a week strip that only showed the days someone wrote
 * would make a broken week look unbroken.
 */
export function recentDays(entries: JournalEntry[], count: number): JournalDay[] {
  const byDate = new Map(entries.map((entry) => [entry.entry_date, entry]));
  const today = toISODate();
  const days: JournalDay[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = toISODate(addDays(new Date(), -offset));
    days.push({ date, entry: byDate.get(date) ?? null, isToday: date === today });
  }

  return days;
}

/** How many entries carry each mood, in scale order, skipping unused moods. */
export function moodCounts(
  entries: JournalEntry[],
): { mood: JournalMood; count: number }[] {
  return JOURNAL_MOODS.map((mood) => ({
    mood,
    count: entries.filter((entry) => entry.mood === mood).length,
  })).filter((bucket) => bucket.count > 0);
}

/**
 * Case-insensitive substring search over everything the user typed on a day —
 * the free text and all three parts of the review.
 *
 * Text only: moods have their own filter, and matching them here would make
 * typing "low" surface every entry marked Low alongside every mention of
 * "slow", which reads as a bug.
 */
export function matchesQuery(entry: JournalEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [entry.content, ...REFLECTION_FIELDS.map((field) => entry[field])].some(
    (text) => text?.toLowerCase().includes(needle),
  );
}

/**
 * One month laid out as calendar cells, Sunday-first.
 *
 * Leading and trailing blanks keep the grid rectangular so the weekday columns
 * line up; a `null` cell is padding, not a day.
 */
export function monthCells(yearMonth: string): (string | null)[] {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return [];

  const lead = new Date(year, month - 1, 1).getDay();
  // Day 0 of the next month is the last day of this one.
  const dayCount = new Date(year, month, 0).getDate();

  const cells: (string | null)[] = Array<string | null>(lead).fill(null);
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(`${yearMonth}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Step a `YYYY-MM` key by whole months, rolling the year over. */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const shifted = new Date(year ?? 1970, (month ?? 1) - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

/** "August 2026" for a `YYYY-MM` key. */
export function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export interface JournalFocus {
  date: string;
  focus: string;
}

/**
 * The most recent "what needs to improve" written before a given day.
 *
 * This is what closes the loop: a review that is only ever written and never
 * read back is journalling, not improving. Surfacing yesterday's intention
 * while today's review is being written is the whole point of keeping the
 * three parts as separate fields.
 */
export function previousFocus(
  entries: JournalEntry[],
  before: string,
): JournalFocus | null {
  const candidates = entries
    .filter((entry) => entry.entry_date < before && entry.to_improve)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  const latest = candidates[0];
  return latest?.to_improve
    ? { date: latest.entry_date, focus: latest.to_improve }
    : null;
}

/** Recent focuses, newest first — the "what I keep meaning to fix" list. */
export function recentFocuses(
  entries: JournalEntry[],
  limit: number,
): JournalFocus[] {
  return entries
    .filter((entry) => entry.to_improve)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, limit)
    .map((entry) => ({ date: entry.entry_date, focus: entry.to_improve! }));
}

/** Narrow weekday initials, Sunday-first, in the viewer's locale. */
export function weekdayInitials(): string[] {
  // 2024-01-07 was a Sunday; walking forward from it gives locale-correct
  // initials without hardcoding English.
  return Array.from({ length: 7 }, (_, offset) =>
    new Date(2024, 0, 7 + offset).toLocaleDateString(undefined, { weekday: 'narrow' }),
  );
}
