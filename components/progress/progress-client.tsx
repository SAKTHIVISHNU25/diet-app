'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProgressSummary, WeightEntry } from '@/types/progress';
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
import { WeightChart } from '@/components/progress/weight-chart';
import { cn, formatDateShort, formatNumber, toISODate } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

export function ProgressClient({
  entries,
  summary,
}: {
  entries: WeightEntry[];
  summary: ProgressSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      refresh();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  const change = summary.change ?? 0;
  const hasChange = Math.abs(change) >= 0.1;

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardContent className="grid grid-cols-3 gap-3 p-4 text-center">
          <Stat label="Starting" value={summary.startingWeight} />
          <Stat label="Current" value={summary.currentWeight} highlight />
          <Stat label="Goal" value={summary.goalWeight} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Change since you started
          </p>
          <p
            className={cn(
              'tabular mt-1 text-2xl font-semibold',
              !hasChange ? 'text-muted-foreground' : change < 0 ? 'text-primary' : '',
            )}
          >
            {hasChange
              ? `${change < 0 ? '−' : '+'}${formatNumber(Math.abs(change), 1)} kg`
              : 'No change yet'}
          </p>
          {summary.toGoal !== null && Math.abs(summary.toGoal) >= 0.1 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tabular">
                {formatNumber(Math.abs(summary.toGoal), 1)} kg
              </span>{' '}
              to your goal.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <WeightChart entries={entries} goalWeight={summary.goalWeight} />

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

      <Card>
        <CardContent className="p-4">
          <h2 className="font-medium">Entries</h2>

          {entries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No weigh-ins yet. Add one to start your trend.
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {[...entries].reverse().map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-medium">
                      {formatNumber(entry.weight_kg, 1)} kg
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                    onClick={() => handleDelete(entry)}
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
        {value === null ? '—' : `${formatNumber(value, 1)}`}
      </p>
      <p className="text-xs text-muted-foreground">kg</p>
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
