'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  monthCells,
  monthLabel,
  shiftMonth,
  weekdayInitials,
} from '@/lib/journal/derive';
import { cn, formatDateLong, toISODate } from '@/lib/utils';

/**
 * Month grid for picking a day. Lives inside the day picker's dialog rather
 * than on the page — it is too tall to sit open for something touched
 * occasionally. Marked days are the ones with something written; which
 * "something" means depends on the tab, so the caller decides.
 */
export function JournalCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  marked,
  legend,
}: {
  /** `YYYY-MM`. */
  month: string;
  onMonthChange: (month: string) => void;
  /** `YYYY-MM-DD`. */
  selected: string;
  onSelect: (date: string) => void;
  marked: Set<string>;
  /** What a marked day means here, e.g. "written". */
  legend: string;
}) {
  const today = toISODate();
  const cells = monthCells(month);
  const initials = weekdayInitials();
  // Future days cannot be journalled, so there is nothing past this month.
  const atCurrentMonth = month >= today.slice(0, 7);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>

        <p className="text-sm font-semibold tracking-tight" aria-live="polite">
          {monthLabel(month)}
        </p>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          disabled={atCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div
        className="mt-1 grid grid-cols-7 gap-1 text-center"
        role="grid"
        aria-label={`Days ${legend}`}
      >
        {initials.map((initial, index) => (
          <span
            key={index}
            className="py-1 text-[0.625rem] font-medium uppercase text-muted-foreground"
            aria-hidden
          >
            {initial}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} aria-hidden />;

          const isMarked = marked.has(date);
          const isSelected = date === selected;
          const isToday = date === today;
          const isFuture = date > today;

          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${formatDateLong(date)}${isMarked ? ` — ${legend}` : ''}`}
              className={cn(
                'tabular relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors',
                isFuture && 'cursor-default text-muted-foreground/40',
                !isFuture && !isSelected && 'hover:bg-muted',
                isMarked && !isSelected && 'bg-accent font-medium text-accent-foreground',
                isSelected && 'bg-primary font-semibold text-primary-foreground',
                isToday && !isSelected && 'ring-1 ring-inset ring-primary',
              )}
            >
              {Number(date.slice(-2))}

              {/* The dot repeats what the fill already says, for anyone who
                  cannot separate the tinted days by colour alone. */}
              {isMarked ? (
                <span
                  className={cn(
                    'absolute bottom-1 size-1 rounded-full',
                    isSelected ? 'bg-primary-foreground' : 'bg-primary',
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
