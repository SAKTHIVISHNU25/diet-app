'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProgressSummary, WeightEntry } from '@/types/progress';
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
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { MotivationNote } from '@/components/progress/motivation-note';
import { WeightChart } from '@/components/progress/weight-chart';
import {
  changeTone,
  DeltaPill,
  WeightJourney,
} from '@/components/progress/weight-journey';
import { cn, formatDateShort, formatNumber, toISODate } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

export function ProgressClient({
  entries,
  summary,
  quote,
}: {
  entries: WeightEntry[];
  summary: ProgressSummary;
  quote: MotivationQuote;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<WeightEntry | null>(null);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  async function handleDelete(entry: WeightEntry) {
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/progress/${entry.id}`, { method: 'DELETE' });
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

  const tone = changeTone(
    summary.change,
    summary.startingWeight,
    summary.goalWeight,
  );
  const hasToGoal = summary.toGoal !== null && Math.abs(summary.toGoal) >= 0.1;

  // Newest first, with the step against the previous weigh-in for each row.
  const rows = [...entries].reverse().map((entry, index, list) => {
    const previous = list[index + 1];
    return {
      entry,
      step: previous ? entry.weight_kg - previous.weight_kg : null,
    };
  });

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Current weight
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <p className="tabular text-4xl font-semibold leading-none">
              {summary.currentWeight === null
                ? '—'
                : formatNumber(summary.currentWeight, 1)}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                kg
              </span>
            </p>
            <DeltaPill change={summary.change} tone={tone} />
          </div>

          <WeightJourney
            className="mt-5"
            startingWeight={summary.startingWeight}
            currentWeight={summary.currentWeight}
            goalWeight={summary.goalWeight}
          />

          <p className="mt-4 text-sm text-muted-foreground">
            {hasToGoal ? (
              <>
                <span className="tabular font-medium text-foreground">
                  {formatNumber(Math.abs(summary.toGoal!), 1)} kg
                </span>{' '}
                to your goal.
              </>
            ) : summary.goalWeight !== null ? (
              <>You&rsquo;re at your goal weight. Nice work.</>
            ) : (
              <>Set a target weight in your profile to track a goal.</>
            )}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-center">
            <Stat label="Starting" value={summary.startingWeight} />
            <Stat label="Current" value={summary.currentWeight} highlight />
            <Stat label="Goal" value={summary.goalWeight} />
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden />
        Add weight
      </Button>

      <WeightChart entries={entries} goalWeight={summary.goalWeight} />

      <MotivationNote initialQuote={quote} />

      <Card>
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Entries</h2>
            {entries.length > 0 ? (
              <p className="tabular text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? 'weigh-in' : 'weigh-ins'}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">No weigh-ins yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first one to start the trend.
              </p>
            </div>
          ) : (
            // Fixed to exactly two rows (2 × 3.75rem) rather than a max-height,
            // so the card is the same size whether there are 3 weigh-ins or 300
            // and adding one never shifts the page below it.
            <ul
              className="scrollbar-slim mt-1 h-[7.5rem] divide-y overflow-y-auto overscroll-contain pr-1"
              tabIndex={0}
              role="list"
              aria-label="Weigh-in history"
            >
              {rows.map(({ entry, step }) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="tabular text-base font-semibold">
                        {formatNumber(entry.weight_kg, 1)}
                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                          kg
                        </span>
                      </p>
                      {step !== null && Math.abs(step) >= 0.1 ? (
                        <span
                          className={cn(
                            'tabular text-xs font-medium',
                            step < 0 ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {step < 0 ? '−' : '+'}
                          {formatNumber(Math.abs(step), 1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateShort(entry.entry_date)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(entry);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirming(entry)}
                    disabled={deletingId === entry.id}
                    aria-label={`Delete entry from ${formatDateShort(entry.entry_date)}`}
                  >
                    {deletingId === entry.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title="Delete this weigh-in?"
        description={
          confirming ? (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(confirming.weight_kg, 1)} kg
              </span>{' '}
              on {formatDateShort(confirming.entry_date)} will be removed from your
              trend. This cannot be undone.
            </>
          ) : null
        }
        pending={confirming !== null && deletingId === confirming.id}
        onConfirm={() => {
          if (confirming) void handleDelete(confirming);
        }}
      />

      <WeightSheet
        open={open}
        entry={editing}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular mt-1 text-lg font-semibold',
          highlight ? 'text-primary' : '',
        )}
      >
        {value === null ? '—' : formatNumber(value, 1)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span>
      </p>
    </div>
  );
}

function WeightSheet({
  open,
  entry,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  entry: WeightEntry | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      entry_date: String(formData.get('entry_date') ?? ''),
      weight_kg: Number(formData.get('weight_kg')),
      note: String(formData.get('note') ?? '').trim() || null,
    };

    setSaving(true);
    try {
      // POST upserts on (user, date), so it handles both new entries and
      // corrections to an existing day.
      const response = entry
        ? await fetch(`/api/progress/${entry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save that weight.'));
        return;
      }

      toast.success(entry ? 'Entry updated' : 'Weight recorded');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{entry ? 'Edit weigh-in' : 'Add weigh-in'}</SheetTitle>
          <SheetDescription>
            One entry per day — saving twice on the same date updates it.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weight_kg">Weight (kg)</Label>
            <Input
              id="weight_kg"
              name="weight_kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={25}
              max={400}
              defaultValue={entry?.weight_kg ?? ''}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry_date">Date</Label>
            <Input
              id="entry_date"
              name="entry_date"
              type="date"
              max={toISODate()}
              defaultValue={entry?.entry_date ?? toISODate()}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              maxLength={200}
              defaultValue={entry?.note ?? ''}
              placeholder="After morning workout"
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
