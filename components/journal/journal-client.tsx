'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  NotebookPen,
  Pencil,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { JournalEntry, JournalMood, JournalSummary } from '@/types/journal';
import { hasReflection } from '@/types/journal';
import type { MotivationQuote } from '@/types/quote';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { MotivationNote } from '@/components/progress/motivation-note';
import { DayPickerBar } from '@/components/journal/day-picker-bar';
import { JournalStats } from '@/components/journal/journal-stats';
import { ReflectionPanel } from '@/components/journal/reflection-panel';
import { MOOD_META, MoodChip, MoodPicker } from '@/components/journal/mood';
import { matchesQuery, moodCounts } from '@/lib/journal/derive';
import { promptForDate } from '@/lib/journal/prompts';
import { cn, formatDateShort, formatRelativeDate, toISODate } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

const MAX_LENGTH = 5000;

export function JournalClient({
  entries,
  summary,
  quote,
}: {
  entries: JournalEntry[];
  summary: JournalSummary;
  quote: MotivationQuote;
}) {
  const router = useRouter();
  const today = toISODate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<JournalEntry | null>(null);
  const [selected, setSelected] = useState(today);
  const [query, setQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<JournalMood | null>(null);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  const byDate = useMemo(
    () => new Map(entries.map((entry) => [entry.entry_date, entry])),
    [entries],
  );
  const selectedEntry = byDate.get(selected) ?? null;

  // Each tab marks the days that matter to it: prose in the journal, the
  // three-part review in the review tab. A day can have one without the other.
  const writtenDates = useMemo(
    () =>
      new Set(
        entries.filter((entry) => entry.content).map((entry) => entry.entry_date),
      ),
    [entries],
  );
  const reviewedDates = useMemo(
    () => new Set(entries.filter(hasReflection).map((entry) => entry.entry_date)),
    [entries],
  );

  const moods = useMemo(() => moodCounts(entries), [entries]);
  const isFiltering = query.trim() !== '' || moodFilter !== null;

  const results = useMemo(
    () =>
      isFiltering
        ? entries.filter(
            (entry) =>
              matchesQuery(entry, query) &&
              (moodFilter === null || entry.mood === moodFilter),
          )
        : [],
    [entries, query, moodFilter, isFiltering],
  );

  async function handleDelete(entry: JournalEntry) {
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/journal/${entry.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not delete that entry.'));
        return;
      }
      toast.success('Entry removed');
      setConfirming(null);
      refresh();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <JournalStats
        entries={entries}
        summary={summary}
        selected={selected}
        onSelectDay={setSelected}
      />

      {/* Two ways to close a day, kept apart on purpose: free writing here,
          the three review questions there. They share one record per day, so
          the picker in each tab marks only what that tab is about. */}
      <Tabs defaultValue="journal">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="review">Daily review</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          <DayPickerBar
            date={selected}
            onChange={setSelected}
            marked={writtenDates}
            legend="written"
          />

          <DayPanel
            entry={selectedEntry}
            date={selected}
            deleting={selectedEntry !== null && deletingId === selectedEntry.id}
            onWrite={() => {
              setEditing(selectedEntry);
              setOpen(true);
            }}
            onDelete={() => {
              if (selectedEntry) setConfirming(selectedEntry);
            }}
          />

          {/* Something to read on the days the blank page wins. Same rotating
              ZenQuotes note the progress page uses, so it is one source. */}
          <MotivationNote initialQuote={quote} />

          {/* Search replaces the old scroll-forever timeline: results only
              appear while you are actually looking for something. */}
          {entries.length >= 4 ? (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your entries"
                  aria-label="Search journal entries"
                  className="pl-9"
                />
              </div>

              {moods.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {moods.map(({ mood, count }) => (
                    <FilterChip
                      key={mood}
                      label={MOOD_META[mood].label}
                      count={count}
                      selected={moodFilter === mood}
                      onClick={() => setMoodFilter(moodFilter === mood ? null : mood)}
                    />
                  ))}
                </div>
              ) : null}

              {isFiltering ? (
                <ResultList
                  results={results}
                  query={query}
                  onPick={setSelected}
                  onClear={() => {
                    setQuery('');
                    setMoodFilter(null);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <DayPickerBar
            date={selected}
            onChange={setSelected}
            marked={reviewedDates}
            legend="reviewed"
          />

          <ReflectionPanel
            date={selected}
            entry={selectedEntry}
            entries={entries}
            onSaved={refresh}
            onSelectDate={setSelected}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title="Delete this entry?"
        description={
          confirming ? (
            <>
              Everything saved for{' '}
              <span className="font-medium text-foreground">
                {formatDateShort(confirming.entry_date)}
              </span>{' '}
              — the entry and its review — will be removed. This cannot be undone.
            </>
          ) : null
        }
        pending={confirming !== null && deletingId === confirming.id}
        onConfirm={() => {
          if (confirming) void handleDelete(confirming);
        }}
      />

      <JournalSheet
        open={open}
        entry={editing}
        date={selected}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

/**
 * The selected day's writing.
 *
 * One day at a time is the whole point of the calendar: the page stays a fixed
 * height no matter how many entries exist, and a long entry scrolls inside its
 * own pane rather than pushing everything below it off the screen.
 */
function DayPanel({
  entry,
  date,
  deleting,
  onWrite,
  onDelete,
}: {
  entry: JournalEntry | null;
  date: string;
  deleting: boolean;
  onWrite: () => void;
  onDelete: () => void;
}) {
  const isToday = date === toISODate();

  if (!entry?.content) {
    return (
      <Card className="border-primary/30 bg-accent/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {isToday ? "Today's prompt" : `Nothing written on ${formatDateShort(date)}`}
              </p>
              <p className="mt-0.5 text-pretty text-sm text-muted-foreground">
                {promptForDate(date)}
              </p>
            </div>
          </div>

          <Button size="lg" className="mt-4 w-full" onClick={onWrite}>
            <NotebookPen aria-hidden />
            {isToday ? "Write today's entry" : 'Write this day'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const edited = entry.updated_at !== entry.created_at;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight">
              {formatRelativeDate(entry.entry_date)}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateShort(entry.entry_date)}
              {edited ? ' · edited' : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {entry.mood ? <MoodChip mood={entry.mood} className="mr-1" /> : null}

            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground"
              onClick={onWrite}
              aria-label={`Edit entry from ${formatDateShort(entry.entry_date)}`}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={deleting}
              aria-label={`Delete entry from ${formatDateShort(entry.entry_date)}`}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        <div className="scrollbar-slim mt-3 max-h-72 overflow-y-auto overscroll-contain pr-1">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {entry.content}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Search hits, in a pane that scrolls rather than growing the page. */
function ResultList({
  results,
  query,
  onPick,
  onClear,
}: {
  results: JournalEntry[];
  query: string;
  onPick: (date: string) => void;
  onClear: () => void;
}) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <p className="text-sm font-medium">No matching entries</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
            <X aria-hidden />
            Clear
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-baseline justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="rounded text-xs font-medium text-primary hover:underline"
          >
            Clear
          </button>
        </div>

        <ul className="scrollbar-slim mt-1 max-h-64 divide-y overflow-y-auto overscroll-contain">
          {results.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onPick(entry.entry_date)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {formatRelativeDate(entry.entry_date)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {snippet(entry, query)}
                  </p>
                </div>
                {entry.mood ? <MoodChip mood={entry.mood} /> : null}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * The line around the match, so a hit is recognisable in a one-line row.
 * Falls back to the opening of the entry when the match is in a review section.
 */
function snippet(entry: JournalEntry, query: string): string {
  const needle = query.trim().toLowerCase();
  const haystacks = [entry.content, entry.went_well, entry.went_wrong, entry.to_improve];

  if (needle) {
    for (const text of haystacks) {
      const at = text?.toLowerCase().indexOf(needle) ?? -1;
      if (at >= 0 && text) {
        const from = Math.max(0, at - 30);
        return `${from > 0 ? '…' : ''}${text.slice(from, from + 120).trim()}`;
      }
    }
  }

  return haystacks.find(Boolean) ?? '';
}

function FilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
      <span className="tabular opacity-70">{count}</span>
    </button>
  );
}

function JournalSheet({
  open,
  entry,
  date,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  entry: JournalEntry | null;
  /** The day the calendar is on — used when there is no entry yet. */
  date: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [mood, setMood] = useState<JournalMood | null>(entry?.mood ?? null);
  const [content, setContent] = useState(entry?.content ?? '');
  const [promptOffset, setPromptOffset] = useState(0);

  const entryDate = entry?.entry_date ?? date;

  // The sheet is reused for every day, so its fields have to follow whichever
  // day it was opened for rather than keeping the first one's state.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = open ? entryDate : null;
  if (key !== lastKey) {
    setLastKey(key);
    setMood(entry?.mood ?? null);
    setContent(entry?.content ?? '');
    setPromptOffset(0);
  }

  const prompt = promptForDate(entryDate, promptOffset);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Write something before saving.');
      return;
    }

    const payload = { entry_date: entryDate, mood, content: trimmed };

    setSaving(true);
    try {
      // POST upserts on (user, date); PATCH is used for a day that already
      // exists so its review sections are left untouched.
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
        toast.error(await readApiError(response, 'Could not save that entry.'));
        return;
      }

      toast.success(entry ? 'Entry updated' : 'Entry saved');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="scrollbar-slim">
        <SheetHeader>
          <SheetTitle>{entry?.content ? 'Edit entry' : 'New entry'}</SheetTitle>
          <SheetDescription>
            {formatRelativeDate(entryDate)} · {formatDateShort(entryDate)}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">
              How was the day?
            </legend>
            <MoodPicker value={mood} onChange={setMood} className="pt-1" />
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="content">Entry</Label>
              <span className="tabular text-xs text-muted-foreground">
                {content.length}/{MAX_LENGTH}
              </span>
            </div>

            {/* A prompt beats a blank box. It is inserted as text rather than
                stored, so the entry stays the person's own words. */}
            <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="min-w-0 flex-1 text-pretty text-xs leading-relaxed text-muted-foreground">
                {prompt}
              </p>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPromptOffset((offset) => offset + 1)}
                  aria-label="Show another prompt"
                >
                  <Shuffle className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    setContent((current) =>
                      current.trim()
                        ? `${current.trimEnd()}\n\n${prompt}\n`
                        : `${prompt}\n`,
                    )
                  }
                >
                  Use
                </Button>
              </div>
            </div>

            <Textarea
              id="content"
              name="content"
              rows={8}
              maxLength={MAX_LENGTH}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Ate well until the evening. Long day, skipped the walk."
              required
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
