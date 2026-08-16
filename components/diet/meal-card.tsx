'use client';

import { useState } from 'react';
import { Loader2, Pencil, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import type { DietPlanMeal } from '@/types/diet-plan';
import { MEAL_TYPE_LABELS } from '@/types/meal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

export function MealCard({
  meal,
  onEdit,
  onReplaced,
}: {
  meal: DietPlanMeal;
  onEdit: () => void;
  onReplaced: () => void;
}) {
  const [replacing, setReplacing] = useState(false);

  async function replace() {
    setReplacing(true);
    try {
      const response = await fetch(`/api/diet-plan/meal/${meal.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: Math.floor(Math.random() * 1_000_000) }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not replace that meal.'));
        return;
      }

      toast.success('Meal replaced');
      onReplaced();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {MEAL_TYPE_LABELS[meal.meal_type]}
            </p>
            <h3 className="mt-0.5 font-medium">{meal.name}</h3>
          </div>
          <span className="tabular shrink-0 text-sm font-medium">
            {formatNumber(meal.calories)} kcal
          </span>
        </div>

        <ul className="mt-3 space-y-1">
          {meal.foods.map((food, index) => (
            <li
              key={`${food.name}-${index}`}
              className="tabular flex justify-between gap-3 text-sm text-muted-foreground"
            >
              <span className="truncate">{food.name}</span>
              <span className="shrink-0">
                {formatNumber(food.grams)} g · {formatNumber(food.calories)} kcal
              </span>
            </li>
          ))}
        </ul>

        <p className="tabular mt-3 text-xs text-muted-foreground">
          P {formatNumber(meal.protein_g, 1)} g · C {formatNumber(meal.carbs_g, 1)} g · F{' '}
          {formatNumber(meal.fat_g, 1)} g
        </p>

        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={replace}
            disabled={replacing}
            className="flex-1"
          >
            {replacing ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Shuffle aria-hidden />
            )}
            Replace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
