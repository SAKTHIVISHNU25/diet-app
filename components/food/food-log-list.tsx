'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodLog } from '@/types/meal';
import { Button } from '@/components/ui/button';
import { EditFoodLogSheet } from '@/components/food/edit-food-log-sheet';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

/** Editable list of logged foods for one meal. */
export function FoodLogList({ logs }: { logs: FoodLog[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      startTransition(() => router.refresh());
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <ul className="mt-2 space-y-1">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-2 pr-1 hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{log.food_name}</p>
              <p className="tabular text-xs text-muted-foreground">
                {formatNumber(log.grams)} g · {formatNumber(log.calories)} kcal ·{' '}
                P {formatNumber(log.protein_g, 1)} · C {formatNumber(log.carbs_g, 1)} ·{' '}
                F {formatNumber(log.fat_g, 1)}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setEditing(log)}
              aria-label={`Edit ${log.food_name}`}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(log)}
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
