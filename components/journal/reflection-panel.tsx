'use client';

import { useState } from 'react';
import { Check, ClipboardList, History, Loader2, Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import type { JournalEntry, ReflectionField } from '@/types/journal';
import { REFLECTION_FIELDS, hasReflection } from '@/types/journal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { REFLECTION_META } from '@/components/journal/reflection';
import { previousFocus, recentFocuses } from '@/lib/journal/derive';
import { REFLECTION_SUGGESTIONS } from '@/lib/journal/prompts';
import { cn, formatDateShort, formatRelativeDate, toISODate } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

const MAX_LENGTH = 1000;
const RECENT_FOCUS_COUNT = 5;

type ReflectionDraft = Record<ReflectionField, string>;

const EMPTY_DRAFT: ReflectionDraft = {
  went_well: '',
  went_wrong: '',
  to_improve: '',
};

/** Dot colour per section, matching that section's own accent. */
const SECTION_DOT: Record<ReflectionField, string> = {
  went_well: 'bg-mood-great',
  went_wrong: 'bg-mood-rough',
  to_improve: 'bg-primary',
};

function draftFrom(entry: JournalEntry | null): ReflectionDraft {
  if (!entry) return EMPTY_DRAFT;
  return {
    went_well: entry.went_well ?? '',
    went_wrong: entry.went_wrong ?? '',
    to_improve: entry.to_improve ?? '',
  };
}

/** Append a line without duplicating it or leaving a leading blank line. */
function appendLine(current: string, line: string): string {
  if (current.toLowerCase().includes(line.toLowerCase())) return current;
  return current.trim() ? `${current.trimEnd()}\n${line}` : line;
}

/**
 * The three-part review for whichever day the picker is on.
 *
 * It writes to the same record as the free-text entry — a day is one node —
 * so reviewing a day that already has prose adds to it rather than creating a
 * second entry, and the streak counts the day once either way. Past reviews
 * are reached through the day picker above, not a list: that keeps the tab one
 * screen tall however many months of reviews exist.
 */
export function ReflectionPanel({
  date,
  entry,
  entries,
  onSaved,
  onSelectDate,
}: {
  /** `YYYY-MM-DD`, owned by the day picker above. */
  date: string;
  entry: JournalEntry | null;
  /** Every entry, for the carry-over and the recent-focus list. */
  entries: JournalEntry[];
  onSaved: () => void;
  onSelectDate: (date: string) => void;
}) {
  const today = toISODate();
  const [saving, setSaving] = useState(false);

  // The form follows whichever day is selected, the same way the editor sheet
  // follows whichever entry opened it.
  const [lastDate, setLastDate] = useState(date);
  const [draft, setDraft] = useState<ReflectionDraft>(() => draftFrom(entry));
  if (date !== lastDate) {
    setLastDate(date);
    setDraft(draftFrom(entry));
  }

  const filled = REFLECTION_FIELDS.filter((field) => draft[field].trim());
  const isDirty = REFLECTION_FIELDS.some(
    (field) => draft[field].trim() !== (entry?.[field] ?? ''),
  );
  const carryOver = previousFocus(entries, date);
  const focuses = recentFocuses(entries, RECENT_FOCUS_COUNT);

  function update(field: ReflectionField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      entry_date: date,
      went_well: draft.went_well.trim() || null,
      went_wrong: draft.went_wrong.trim() || null,
      to_improve: draft.to_improve.trim() || null,
    };

    // An existing day is PATCHed so the review can be cleared back out; a new
    // day is POSTed, and a POST with nothing in it would be a blank entry.
    if (!entry && filled.length === 0) {
      toast.error('Fill in at least one section before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = entry
        ? await fetch(`/api/journal/${entry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save your review.'));
        return;
      }

      // Adopt the trimmed values the server stored, so the Save button settles
      // back to disabled instead of staying "dirty" over trailing whitespace.
      setDraft({
        went_well: payload.went_well ?? '',
        went_wrong: payload.went_wrong ?? '',
        to_improve: payload.to_improve ?? '',
      });
      toast.success('Review saved');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <ClipboardList className="size-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="font-semibold tracking-tight">
                {date === today ? "Today's review" : formatRelativeDate(date)}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateShort(date)}
                {entry && hasReflection(entry) ? ' · reviewed' : ''}
              </p>
            </div>

            {/* Three dots: which sections are answered, without reading down
                the form. One is a review; three is a good one. */}
            <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
              {REFLECTION_FIELDS.map((field) => (
                <span
                  key={field}
                  className={cn(
                    'size-2 rounded-full transition-colors',
                    draft[field].trim() ? SECTION_DOT[field] : 'bg-muted',
                  )}
                  title={REFLECTION_META[field].label}
                />
              ))}
              <span className="sr-only">
                {filled.length} of {REFLECTION_FIELDS.length} sections filled
              </span>
            </div>
          </div>

          {/* Yesterday's intention, in front of you while today's is written.
              Without this a review is only ever written, never read back. */}
          {carryOver ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
              <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">
                  Focus from {formatRelativeDate(carryOver.date)}
                </p>
                <p className="mt-0.5 text-pretty text-sm text-muted-foreground">
                  {carryOver.focus}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs"
                onClick={() =>
                  update('to_improve', appendLine(draft.to_improve, carryOver.focus))
                }
              >
                Carry over
              </Button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {REFLECTION_FIELDS.map((field) => (
              <ReflectionSection
                key={field}
                field={field}
                value={draft[field]}
                onChange={(value) => update(field, value)}
              />
            ))}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={saving || !isDirty}
            >
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              {entry && hasReflection(entry) ? 'Update review' : 'Save review'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Collapsed by default — the value is in checking whether the same fix
          keeps reappearing, not in reading the list every day. */}
      {focuses.length > 0 ? (
        <details className="group rounded-xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium">
            <History className="size-4 text-muted-foreground" aria-hidden />
            Recent focuses
            <span className="tabular ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              {focuses.length}
            </span>
            <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">
              Hide
            </span>
          </summary>

          <ul className="space-y-1 px-3 pb-3">
            {focuses.map((item) => (
              <li key={item.date}>
                <button
                  type="button"
                  onClick={() => onSelectDate(item.date)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
                >
                  <Target
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {item.focus}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateShort(item.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ReflectionSection({
  field,
  value,
  onChange,
}: {
  field: ReflectionField;
  value: string;
  onChange: (value: string) => void;
}) {
  const meta = REFLECTION_META[field];
  const Icon = meta.icon;
  const answered = Boolean(value.trim());

  return (
    <section
      className={cn(
        'rounded-xl border p-3 transition-colors',
        answered ? 'bg-muted/30' : 'bg-transparent',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            meta.tint,
            meta.text,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>

        <label htmlFor={field} className="flex-1 text-sm font-medium">
          {meta.label}
        </label>

        {answered ? (
          <span className="tabular text-xs text-muted-foreground">
            {value.length}/{MAX_LENGTH}
          </span>
        ) : null}
      </div>

      <Textarea
        id={field}
        rows={answered ? 3 : 2}
        maxLength={MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={meta.placeholder}
        className="mt-2 bg-background"
      />

      {/* Suggestions disappear once there is something to say — they are a way
          in, not a fixture stealing height from the form. */}
      {!answered ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {REFLECTION_SUGGESTIONS[field].map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => onChange(appendLine(value, suggestion))}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3" aria-hidden />
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
