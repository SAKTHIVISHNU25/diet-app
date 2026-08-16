import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import type { JournalEntry } from '@/types/journal';
import {
  journalEntrySchema,
  journalEntryUpdateSchema,
} from '@/lib/validations/journal';
import { addDays, toISODate } from '@/lib/utils';
import {
  matchesQuery,
  monthCells,
  monthLabel,
  moodCounts,
  previousFocus,
  recentDays,
  recentFocuses,
  shiftMonth,
} from '@/lib/journal/derive';
import { JOURNAL_PROMPTS, promptForDate } from '@/lib/journal/prompts';

// The data module pulls in record-crypto, whose keyring is read from the
// environment on first use — set it before the dynamic import below.
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

const { summarizeJournal } = await import('@/lib/data/journal');

function entry(date: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: date,
    user_id: 'user-abc',
    entry_date: date,
    mood: null,
    content: 'A day.',
    went_well: null,
    went_wrong: null,
    to_improve: null,
    created_at: '2026-08-16T00:00:00.000Z',
    updated_at: '2026-08-16T00:00:00.000Z',
    ...overrides,
  };
}

const daysAgo = (n: number) => toISODate(addDays(new Date(), -n));

describe('journalEntrySchema', () => {
  it('accepts a valid entry', () => {
    expect(
      journalEntrySchema.safeParse({
        entry_date: '2026-08-15',
        mood: 'good',
        content: 'Stayed under target.',
      }).success,
    ).toBe(true);
  });

  it('defaults a missing mood to null', () => {
    const parsed = journalEntrySchema.parse({
      entry_date: '2026-08-15',
      content: 'No mood today.',
    });
    expect(parsed.mood).toBeNull();
  });

  it('rejects an unknown mood', () => {
    expect(
      journalEntrySchema.safeParse({
        entry_date: '2026-08-15',
        mood: 'ecstatic',
        content: 'Hello.',
      }).success,
    ).toBe(false);
  });

  it('rejects a day with nothing written at all', () => {
    expect(
      journalEntrySchema.safeParse({ entry_date: '2026-08-15', content: '   ' })
        .success,
    ).toBe(false);
  });

  it('accepts a review-only day, with no free text', () => {
    const parsed = journalEntrySchema.parse({
      entry_date: '2026-08-15',
      went_well: 'Walked after dinner.',
    });
    expect(parsed.content).toBe('');
    expect(parsed.went_well).toBe('Walked after dinner.');
    expect(parsed.went_wrong).toBeNull();
  });

  it('normalises blank review sections to null', () => {
    const parsed = journalEntrySchema.parse({
      entry_date: '2026-08-15',
      content: 'Fine day.',
      went_well: '   ',
    });
    expect(parsed.went_well).toBeNull();
  });

  it('rejects an over-long review section', () => {
    expect(
      journalEntrySchema.safeParse({
        entry_date: '2026-08-15',
        to_improve: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('rejects content over the length cap', () => {
    expect(
      journalEntrySchema.safeParse({
        entry_date: '2026-08-15',
        content: 'x'.repeat(5001),
      }).success,
    ).toBe(false);
  });
});

describe('journalEntryUpdateSchema', () => {
  it('allows clearing a review section, which the create schema would reject', () => {
    const parsed = journalEntryUpdateSchema.parse({ went_well: null });
    expect(parsed.went_well).toBeNull();
  });

  it('still enforces the length caps', () => {
    expect(
      journalEntryUpdateSchema.safeParse({ went_wrong: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });
});

describe('summarizeJournal', () => {
  it('reports zero for an empty journal', () => {
    expect(summarizeJournal([])).toEqual({
      entryCount: 0,
      streak: 0,
      last30Days: 0,
      topMood: null,
      reflectionCount: 0,
    });
  });

  it('counts a streak running back from today', () => {
    const entries = [entry(daysAgo(0)), entry(daysAgo(1)), entry(daysAgo(2))];
    expect(summarizeJournal(entries).streak).toBe(3);
  });

  it('keeps the streak alive when today is not written yet', () => {
    const entries = [entry(daysAgo(1)), entry(daysAgo(2))];
    expect(summarizeJournal(entries).streak).toBe(2);
  });

  it('breaks the streak on a missed day', () => {
    const entries = [entry(daysAgo(0)), entry(daysAgo(2)), entry(daysAgo(3))];
    expect(summarizeJournal(entries).streak).toBe(1);
  });

  it('is zero when the most recent entry is older than yesterday', () => {
    expect(summarizeJournal([entry(daysAgo(5))]).streak).toBe(0);
  });

  it('counts only the last 30 days in last30Days', () => {
    const entries = [entry(daysAgo(0)), entry(daysAgo(29)), entry(daysAgo(45))];
    const summary = summarizeJournal(entries);
    expect(summary.entryCount).toBe(3);
    expect(summary.last30Days).toBe(2);
  });

  it('counts the days carrying any part of the review', () => {
    const entries = [
      entry(daysAgo(0), { went_well: 'Protein target hit.' }),
      entry(daysAgo(1), { to_improve: 'Prep lunch.' }),
      entry(daysAgo(2)),
    ];
    expect(summarizeJournal(entries).reflectionCount).toBe(2);
  });

  it('picks the most frequently logged mood, ignoring entries without one', () => {
    const entries = [
      entry(daysAgo(0), { mood: 'low' }),
      entry(daysAgo(1), { mood: 'good' }),
      entry(daysAgo(2), { mood: 'good' }),
      entry(daysAgo(3)),
    ];
    expect(summarizeJournal(entries).topMood).toBe('good');
  });
});

describe('moodCounts', () => {
  it('counts moods in scale order and omits unused ones', () => {
    const counts = moodCounts([
      entry('2026-08-01', { mood: 'rough' }),
      entry('2026-08-02', { mood: 'great' }),
      entry('2026-08-03', { mood: 'great' }),
      entry('2026-08-04'),
    ]);
    expect(counts).toEqual([
      { mood: 'great', count: 2 },
      { mood: 'rough', count: 1 },
    ]);
  });
});

describe('matchesQuery', () => {
  const target = entry('2026-08-01', { content: 'Skipped the evening WALK' });

  it('matches case-insensitively on content', () => {
    expect(matchesQuery(target, 'walk')).toBe(true);
    expect(matchesQuery(target, 'run')).toBe(false);
  });

  it('treats a blank query as no filter', () => {
    expect(matchesQuery(target, '   ')).toBe(true);
  });

  it('searches the review sections as well as the free text', () => {
    const reviewed = entry('2026-08-03', {
      content: '',
      to_improve: 'Prep lunch the night before',
    });
    expect(matchesQuery(reviewed, 'prep lunch')).toBe(true);
  });

  it('does not match on mood, which has its own filter', () => {
    expect(matchesQuery(entry('2026-08-02', { mood: 'low' }), 'low')).toBe(false);
  });
});

describe('promptForDate', () => {
  it('is stable for a given date', () => {
    expect(promptForDate('2026-08-16')).toBe(promptForDate('2026-08-16'));
  });

  it('moves to a different prompt when shuffled', () => {
    expect(promptForDate('2026-08-16', 1)).not.toBe(promptForDate('2026-08-16'));
  });

  it('wraps around rather than running off the end', () => {
    expect(JOURNAL_PROMPTS).toContain(promptForDate('2026-08-16', 999));
  });
});

describe('recentDays', () => {
  it('returns the window oldest-first, ending today', () => {
    const days = recentDays([], 7);
    expect(days).toHaveLength(7);
    expect(days.at(-1)?.date).toBe(toISODate());
    expect(days.at(-1)?.isToday).toBe(true);
    expect(days.at(0)?.date).toBe(daysAgo(6));
  });

  it('keeps unwritten days in the window rather than dropping them', () => {
    const days = recentDays([entry(daysAgo(0)), entry(daysAgo(3))], 7);
    expect(days.filter((day) => day.entry !== null).map((day) => day.date)).toEqual([
      daysAgo(3),
      daysAgo(0),
    ]);
    expect(days.filter((day) => day.entry === null)).toHaveLength(5);
  });

  it('ignores entries outside the window', () => {
    const days = recentDays([entry(daysAgo(30))], 7);
    expect(days.every((day) => day.entry === null)).toBe(true);
  });
});

describe('monthCells', () => {
  it('pads the start so the first day lands on its weekday', () => {
    // 1 August 2026 is a Saturday, the last column of a Sunday-first grid.
    const cells = monthCells('2026-08');
    expect(cells.slice(0, 6).every((cell) => cell === null)).toBe(true);
    expect(cells[6]).toBe('2026-08-01');
  });

  it('covers every day of the month', () => {
    const august = monthCells('2026-08').filter(Boolean);
    expect(august).toHaveLength(31);
    expect(august.at(-1)).toBe('2026-08-31');

    expect(monthCells('2026-02').filter(Boolean)).toHaveLength(28);
    expect(monthCells('2024-02').filter(Boolean)).toHaveLength(29);
  });

  it('always returns whole weeks', () => {
    for (const month of ['2026-01', '2026-02', '2026-08', '2024-02']) {
      expect(monthCells(month).length % 7).toBe(0);
    }
  });
});

describe('shiftMonth', () => {
  it('steps forward and back', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09');
    expect(shiftMonth('2026-08', -1)).toBe('2026-07');
  });

  it('rolls the year over at both ends', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('monthLabel', () => {
  it('names the month and year', () => {
    expect(monthLabel('2026-08')).toMatch(/2026/);
  });
});

describe('previousFocus', () => {
  const entries = [
    entry('2026-08-10', { to_improve: 'Prep lunch' }),
    entry('2026-08-12', { to_improve: 'Walk after dinner' }),
    entry('2026-08-14', { went_well: 'Good day' }),
  ];

  it('finds the most recent focus written before the given day', () => {
    expect(previousFocus(entries, '2026-08-16')).toEqual({
      date: '2026-08-12',
      focus: 'Walk after dinner',
    });
  });

  it('never returns the day itself, so today does not carry over to today', () => {
    expect(previousFocus(entries, '2026-08-12')).toEqual({
      date: '2026-08-10',
      focus: 'Prep lunch',
    });
  });

  it('skips days that were reviewed without a focus', () => {
    expect(previousFocus([entry('2026-08-14', { went_well: 'Good' })], '2026-08-16'))
      .toBeNull();
  });

  it('is null when nothing precedes the day', () => {
    expect(previousFocus(entries, '2026-08-01')).toBeNull();
  });
});

describe('recentFocuses', () => {
  it('returns focuses newest first, capped at the limit', () => {
    const entries = [
      entry('2026-08-10', { to_improve: 'A' }),
      entry('2026-08-12', { to_improve: 'B' }),
      entry('2026-08-14', { to_improve: 'C' }),
      entry('2026-08-15', { went_wrong: 'No focus here' }),
    ];

    expect(recentFocuses(entries, 2)).toEqual([
      { date: '2026-08-14', focus: 'C' },
      { date: '2026-08-12', focus: 'B' },
    ]);
  });

  it('is empty when no day has a focus', () => {
    expect(recentFocuses([entry('2026-08-14')], 5)).toEqual([]);
  });
});
