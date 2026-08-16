'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DietPlanMeal, PlannedFood } from '@/types/diet-plan';
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
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

/**
 * Edit a planned meal: rename it, rescale a food's portion, or drop a food.
 *
 * Changing a portion rescales that food's own macros; the server recomputes the
 * meal totals from the submitted foods, so the two can never disagree.
 */
export function EditMealSheet({
  meal,
  onOpenChange,
  onSaved,
}: {
  meal: DietPlanMeal | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [foods, setFoods] = useState<PlannedFood[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!meal) return;
    setName(meal.name);
    setFoods(meal.foods);
  }, [meal]);

  if (!meal) return null;

  function updateGrams(index: number, grams: number) {
    setFoods((current) =>
      current.map((food, i) => {
        if (i !== index) return food;
        const original = meal!.foods[index];
        if (!original || original.grams <= 0) return { ...food, grams };
        const factor = grams / original.grams;
        return {
          ...food,
          grams,
          calories: Math.round(original.calories * factor),
          protein_g: round1(original.protein_g * factor),
          carbs_g: round1(original.carbs_g * factor),
          fat_g: round1(original.fat_g * factor),
        };
      }),
    );
  }

  const totals = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein_g: acc.protein_g + food.protein_g,
    }),
    { calories: 0, protein_g: 0 },
  );

  async function save() {
    if (!meal) return;
    if (!name.trim()) {
      toast.error('Please give the meal a name.');
      return;
    }
    if (foods.length === 0) {
      toast.error('A meal needs at least one food.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/diet-plan/meal/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), foods }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save the meal.'));
        return;
      }

      toast.success('Meal updated');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(meal)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Edit meal</SheetTitle>
          <SheetDescription>
            Adjust portions or remove foods. Totals update automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meal-name">Meal name</Label>
            <Input
              id="meal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <ul className="space-y-2">
            {foods.map((food, index) => (
              <li
                key={`${food.name}-${index}`}
                className="flex items-end gap-2 rounded-xl border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{food.name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatNumber(food.calories)} kcal · P{' '}
                    {formatNumber(food.protein_g, 1)} g
                  </p>
                </div>

                <div className="w-24 space-y-1">
                  <Label
                    htmlFor={`food-grams-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    grams
                  </Label>
                  <Input
                    id={`food-grams-${index}`}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={5000}
                    value={food.grams}
                    onChange={(event) => {
                      const value = Number.parseFloat(event.target.value);
                      updateGrams(index, Number.isFinite(value) && value > 0 ? value : 0);
                    }}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${food.name}`}
                  onClick={() =>
                    setFoods((current) => current.filter((_, i) => i !== index))
                  }
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          <p className="tabular rounded-xl bg-muted/60 p-3 text-sm">
            Meal total: {formatNumber(totals.calories)} kcal · P{' '}
            {formatNumber(totals.protein_g, 1)} g
          </p>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save meal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
