'use client';

import { Flame, PenLine } from 'lucide-react';
import type { JournalEntry, JournalSummary } from '@/types/journal';
import { Card, CardContent } from '@/components/ui/card';
import { MOOD_META } from '@/components/journal/mood';
import { moodCounts, recentDays } from '@/lib/journal/derive';
import { cn, formatDateLong, formatNumber } from '@/lib/utils';

/**
 * One compact header card: the streak, the totals and the mood mix.
 *
 * Deliberately short. The calendar below is the thing worth screen space, and
 * a habit strip here would only repeat what the month grid already shows.
 */
export function JournalStats({
  entries,
  summary,
  selected,
  onSelectDay,
}: {
  entries: JournalEntry[];
  summary: JournalSummary;
  /** The day the tabs below are showing, so the strip can mark it. */
  selected: string;
  onSelectDay: (date: string) => void;
}) {
  const week = recentDays(entries, 7);
  const moods = moodCounts(entries);
  const moodTotal = moods.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl',
              summary.streak > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Flame className="size-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-1.5">
              <span className="tabular text-2xl font-semibold leading-none text-primary">
                {summary.streak}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                day streak
              </span>
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {streakMessage(summary)}
            </p>
          </div>

          <div className="flex shrink-0 gap-4 border-l pl-4 text-center">
            <Stat label="Entries" value={formatNumber(summary.entryCount)} />
            <Stat label="30 days" value={`${summary.last30Days}/30`} />
          </div>
        </div>

        {/* The mood week. Seven taps' worth of history, and the fastest way
            back to a recent day — the gaps stay visible as dashed slots. */}
        <ul
          className="mt-3 flex justify-between gap-1 border-t pt-3"
          aria-label="The last seven days"
        >
          {week.map((day) => {
            const meta = day.entry?.mood ? MOOD_META[day.entry.mood] : null;
            const Icon = meta?.icon;
            const written = Boolean(day.entry);
            const isSelected = day.date === selected;

            return (
              <li key={day.date} className="flex flex-col items-center gap-1">
                <span className="text-[0.625rem] font-medium uppercase text-muted-foreground">
                  {weekdayLetter(day.date)}
                </span>

                {/* A fixed square, not a stretched cell: `size-11` keeps the
                    tile the same shape at every screen width and is still a
                    44px tap target. */}
                <button
                  type="button"
                  onClick={() => onSelectDay(day.date)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDateLong(day.date)} — ${
                    written ? 'written' : 'not written'
                  }`}
                  className={cn(
                    'flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors',
                    written
                      ? cn(
                          'border-transparent',
                          meta ? cn(meta.tint, meta.text) : 'bg-primary/10 text-primary',
                        )
                      : 'border-dashed text-muted-foreground hover:bg-muted',
                    isSelected && 'ring-2 ring-ring ring-offset-1 ring-offset-card',
                  )}
                >
                  {/* Every tile carries its date, so an unwritten day reads as
                      a day rather than an empty box. */}
                  <span className="tabular text-[0.6875rem] font-medium leading-none">
                    {Number(day.date.slice(-2))}
                  </span>

                  {written ? (
                    Icon ? (
                      <Icon className="size-4" aria-hidden />
                    ) : (
                      <PenLine className="size-3.5" aria-hidden />
                    )
                  ) : (
                    <span
                      className="size-1 rounded-full bg-current opacity-25"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {moodTotal > 0 ? (
          <div className="mt-3 border-t pt-3">
            {/* Proportional, not a chart: the legend carries the counts, so the
                bar only has to show which way the weeks have leaned. */}
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={moods
                .map(({ mood, count }) => `${MOOD_META[mood].label}: ${count}`)
                .join(', ')}
            >
              {moods.map(({ mood, count }) => (
                <span
                  key={mood}
                  className={MOOD_META[mood].solid}
                  style={{ width: `${(count / moodTotal) * 100}%` }}
                />
              ))}
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {moods.map(({ mood, count }) => (
                <li
                  key={mood}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={cn('size-2 rounded-full', MOOD_META[mood].solid)}
                    aria-hidden
                  />
                  {MOOD_META[mood].label}
                  <span className="tabular font-medium text-foreground">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function weekdayLetter(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    undefined,
    { weekday: 'narrow' },
  );
}

/** Encouragement that stays honest — no "great work" for an empty journal. */
function streakMessage(summary: JournalSummary): string {
  if (summary.entryCount === 0) return 'Write your first entry to start a streak.';
  if (summary.streak === 0) return 'One entry today restarts it.';
  if (summary.streak === 1) return 'Day one. Come back tomorrow to make it two.';
  if (summary.streak < 7) return 'Keep it going.';
  return 'This is a habit now.';
}
