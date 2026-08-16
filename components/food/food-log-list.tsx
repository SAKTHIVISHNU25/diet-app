'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodLog } from '@/types/meal';
import { Button } from '@/components/ui/button';
import { EditFoodLogSheet } from '@/components/food/edit-food-log-sheet';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { MacroDots } from '@/components/food/macro-dots';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

/** Editable list of logged foods for one meal. */
export function FoodLogList({ logs }: { logs: FoodLog[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<FoodLog | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete(log: FoodLog) {
    setDeletingId(log.id);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, { method: 'DELETE' });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not delete that entry.'));
        return;
      }

      toast.success(`Removed ${log.food_name}`);
      setConfirming(null);
      startTransition(() => router.refresh());
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <ul className="mt-1.5 space-y-0.5">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex items-center gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium first-letter:uppercase">
                  {log.food_name}
                </p>
                <p className="tabular shrink-0 text-sm font-medium">
                  {formatNumber(log.calories)}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    kcal
                  </span>
                </p>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="tabular text-xs text-muted-foreground">
                  {formatNumber(log.grams)} g
                </span>
                <span className="text-xs text-muted-foreground/40" aria-hidden>
                  |
                </span>
                <MacroDots
                  protein={log.protein_g}
                  carbs={log.carbs_g}
                  fat={log.fat_g}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(log)}
              aria-label={`Edit ${log.food_name}`}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirming(log)}
              disabled={deletingId === log.id}
              aria-label={`Delete ${log.food_name}`}
            >
              {deletingId === log.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDeleteDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title="Remove this food?"
        description={
          confirming ? (
            <>
              <span className="font-medium text-foreground">
                {confirming.food_name}
              </span>{' '}
              and its {formatNumber(confirming.calories)} kcal will come off this
              meal. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Remove"
        pending={confirming !== null && deletingId === confirming.id}
        onConfirm={() => {
          if (confirming) void handleDelete(confirming);
        }}
      />

      <EditFoodLogSheet
        log={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}
