export const JOURNAL_MOODS = ['great', 'good', 'okay', 'low', 'rough'] as const;

export type JournalMood = (typeof JOURNAL_MOODS)[number];

export const JOURNAL_MOOD_LABELS: Record<JournalMood, string> = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  low: 'Low',
  rough: 'Rough',
};

/**
 * The three-part daily review, stored on the same entry as the free text.
 *
 * They are separate fields rather than headings inside `content` so a day's
 * review can be read back section by section — "what needs to improve" across
 * a month is the useful view, and that is impossible to pull out of prose.
 */
export const REFLECTION_FIELDS = ['went_well', 'went_wrong', 'to_improve'] as const;

export type ReflectionField = (typeof REFLECTION_FIELDS)[number];

export const REFLECTION_LABELS: Record<ReflectionField, string> = {
  went_well: 'What went well',
  went_wrong: 'What went wrong',
  to_improve: 'What needs to improve',
};

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  mood: JournalMood | null;
  content: string;
  went_well: string | null;
  went_wrong: string | null;
  to_improve: string | null;
  created_at: string;
  updated_at: string;
}

/** True when the entry carries any part of the three-part review. */
export function hasReflection(entry: JournalEntry): boolean {
  return REFLECTION_FIELDS.some((field) => Boolean(entry[field]));
}

export interface JournalSummary {
  entryCount: number;
  /** Consecutive days written, counting back from today (or yesterday). */
  streak: number;
  /** Entries written in the last 30 days. */
  last30Days: number;
  /** The mood logged most often across all entries, if any mood was logged. */
  topMood: JournalMood | null;
  /** Entries carrying at least one part of the three-part review. */
  reflectionCount: number;
}
