'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { JournalCalendar } from '@/components/journal/journal-calendar';
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatRelativeDate,
  fromISODate,
  toISODate,
} from '@/lib/utils';

/**
 * The day selector: arrows for the day either side, a calendar icon for
 * everything else.
 *
 * The month grid used to sit open on the page and took most of a screen for
 * something people touch occasionally — stepping a day at a time covers the
 * common case, and the full calendar is one tap away when it is not.
 */
export function DayPickerBar({
  date,
  onChange,
  marked,
  legend,
}: {
  /** `YYYY-MM-DD`. */
  date: string;
  onChange: (date: string) => void;
  /** Days to mark in the calendar — meaning depends on the tab. */
  marked: Set<string>;
  /** What a marked day means here, e.g. "written". */
  legend: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));

  const today = toISODate();
  const step = (days: number) => onChange(toISODate(addDays(fromISODate(date), days)));

  const label = formatRelativeDate(date);
  // "Today" and "Yesterday" say nothing about which date that is, so they get
  // the short date beside them. Every other label already spells it out.
  // `formatRelativeDate` returns the long date for anything older, so a label
  // that differs from it is a relative one.
  const needsDate = label !== formatDateLong(date);

  return (
    // Centred rather than stretched: a full-width bar left the date marooned
    // in the middle of an empty pill on anything wider than a phone.
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        onClick={() => step(-1)}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <button
        type="button"
        onClick={() => {
          // Always open on the month being viewed, not wherever it was left.
          setMonth(date.slice(0, 7));
          setOpen(true);
        }}
        className="flex min-h-10 min-w-48 max-w-xs flex-1 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
        aria-label={`${label} — open the calendar`}
      >
        <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />

        {/* The two labels are different sizes, so they sit on a shared
            baseline — centring them instead leaves the smaller one floating. */}
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate">{label}</span>
          {needsDate ? (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {formatDateShort(date)}
            </span>
          ) : null}
        </span>
      </button>

      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        onClick={() => step(1)}
        disabled={date >= today}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick a day</DialogTitle>
            <DialogDescription>
              Highlighted days are the ones {legend}.
            </DialogDescription>
          </DialogHeader>

          <JournalCalendar
            month={month}
            onMonthChange={setMonth}
            selected={date}
            onSelect={(picked) => {
              onChange(picked);
              setOpen(false);
            }}
            marked={marked}
            legend={legend}
          />

          {date !== today ? (
            <Button
              variant="outline"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              Jump to today
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
