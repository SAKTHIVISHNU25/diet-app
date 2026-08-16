'use client';

import { useEffect, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodLog, MealType } from '@/types/meal';
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '@/types/meal';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clamp, cn } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

const MIN_GRAMS = 1;
const MAX_GRAMS = 5000;
/** How much the −/+ buttons move the portion. */
const PORTION_STEP = 10;
/** Common serving sizes, one tap away. */
const PORTION_PRESETS = [50, 100, 150, 200, 250] as const;

interface EditFoodLogSheetProps {
  log: FoodLog | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Edit a logged food.
 *
 * Changing the portion rescales calories and macros from the entry's own
 * per-gram values, so the numbers stay internally consistent without another
 * nutrition lookup.
 */
export function EditFoodLogSheet({ log, onOpenChange, onSaved }: EditFoodLogSheetProps) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [mealType, setMealType] = useState<MealType>('other');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!log) return;
    setName(log.food_name);
    setGrams(String(log.grams));
    setMealType(log.meal_type);
  }, [log]);

  if (!log) return null;

  const parsedGrams = Number.parseFloat(grams);
  const validGrams = Number.isFinite(parsedGrams) && parsedGrams > 0;

  // Per-gram values recovered from the original entry.
  const factor = validGrams ? parsedGrams / log.grams : 1;
  const preview = {
    calories: Math.round(log.calories * factor),
    protein_g: round1(log.protein_g * factor),
    carbs_g: round1(log.carbs_g * factor),
    fat_g: round1(log.fat_g * factor),
  };

  const calorieDelta = preview.calories - Math.round(log.calories);

  /** Step the portion, snapping to the step grid so ± stays predictable. */
  function nudge(delta: number) {
    const base = validGrams ? parsedGrams : MIN_GRAMS;
    const next =
      delta > 0
        ? Math.floor(base / PORTION_STEP) * PORTION_STEP + PORTION_STEP
        : Math.ceil(base / PORTION_STEP) * PORTION_STEP - PORTION_STEP;
    setGrams(String(clamp(next, MIN_GRAMS, MAX_GRAMS)));
  }

  async function handleSave() {
    if (!log) return;
    if (!name.trim()) {
      toast.error('Please enter a food name.');
      return;
    }
    if (!validGrams) {
      toast.error('Please enter a portion greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_name: name.trim(),
          grams: parsedGrams,
          meal_type: mealType,
          ...preview,
        }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save your changes.'));
        return;
      }

      toast.success('Updated');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(log)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Edit food</SheetTitle>
          <SheetDescription>
            Adjust the portion and we&apos;ll rescale the nutrition.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Food</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-grams">Portion</Label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                onClick={() => nudge(-PORTION_STEP)}
                disabled={!validGrams || parsedGrams <= MIN_GRAMS}
                aria-label={`Decrease portion by ${PORTION_STEP} grams`}
              >
                <Minus className="size-4" aria-hidden />
              </Button>

              <div className="relative flex-1">
                <Input
                  id="edit-grams"
                  type="number"
                  inputMode="decimal"
                  min={MIN_GRAMS}
                  max={MAX_GRAMS}
                  value={grams}
                  onChange={(event) => setGrams(event.target.value)}
                  className="tabular h-11 pr-8 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-hidden
                >
                  g
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                onClick={() => nudge(PORTION_STEP)}
                disabled={validGrams && parsedGrams >= MAX_GRAMS}
                aria-label={`Increase portion by ${PORTION_STEP} grams`}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {PORTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGrams(String(preset))}
                  aria-pressed={parsedGrams === preset}
                  className={cn(
                    'tabular rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    parsedGrams === preset
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {preset} g
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-meal">Meal</Label>
            <Select
              value={mealType}
              onValueChange={(value) => setMealType(value as MealType)}
            >
              <SelectTrigger id="edit-meal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MEAL_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Calories
                </p>
                <p className="tabular mt-0.5 text-3xl font-semibold leading-none">
                  {preview.calories}
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    kcal
                  </span>
                </p>
              </div>

              {calorieDelta !== 0 ? (
                <span className="tabular rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {calorieDelta > 0 ? '+' : '−'}
                  {Math.abs(calorieDelta)} vs saved
                </span>
              ) : null}
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
              <MacroStat label="Protein" value={preview.protein_g} dot="bg-protein" />
              <MacroStat label="Carbs" value={preview.carbs_g} dot="bg-carbs" />
              <MacroStat label="Fat" value={preview.fat_g} dot="bg-fat" />
            </dl>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MacroStat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-sm font-medium">{value} g</dd>
    </div>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
