'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { DietPlanMeal, DietPlanWithMeals } from '@/types/diet-plan';
import type { NutritionTargets } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MealCard } from '@/components/diet/meal-card';
import { EditMealSheet } from '@/components/diet/edit-meal-sheet';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function DietPlanClient({
  plan,
  targets,
}: {
  plan: DietPlanWithMeals | null;
  targets: NutritionTargets;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<DietPlanMeal | null>(null);
  const [, startTransition] = useTransition();

  async function generate() {
    setGenerating(true);
    try {
      const response = await fetch('/api/diet-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A fresh seed each time, so "regenerate" produces a different plan.
        body: JSON.stringify({
          replaceActive: true,
          seed: Math.floor(Math.random() * 1_000_000),
        }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not generate a plan.'));
        return;
      }

      toast.success('Your 7-day plan is ready.');
      startTransition(() => router.refresh());
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (!plan || plan.meals.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6 text-center">
          <Sparkles className="mx-auto size-8 text-primary" aria-hidden />
          <h2 className="mt-3 font-medium">No plan yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a 7-day plan built around your calorie and protein targets,
            your dietary preference and your allergies.
          </p>
          <Button className="mt-5 w-full" size="lg" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {generating ? 'Building your plan…' : 'Generate my plan'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6">
      <Tabs defaultValue="0">
        <TabsList className="flex w-full overflow-x-auto">
          {DAYS.map((day) => (
            <TabsTrigger key={day} value={String(day)} className="flex-1 min-w-14">
              Day {day + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {DAYS.map((day) => {
          const meals = plan.meals.filter((meal) => meal.day_index === day);
          const totals = meals.reduce(
            (acc, meal) => ({
              calories: acc.calories + meal.calories,
              protein_g: acc.protein_g + meal.protein_g,
              carbs_g: acc.carbs_g + meal.carbs_g,
              fat_g: acc.fat_g + meal.fat_g,
            }),
            { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          );

          return (
            <TabsContent key={day} value={String(day)} className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Day total
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="tabular text-xl font-semibold">
                      {formatNumber(totals.calories)} kcal
                    </span>
                    <span className="tabular text-sm text-muted-foreground">
                      target {formatNumber(targets.calories)}
                    </span>
                  </div>
                  <p className="tabular mt-1 text-sm text-muted-foreground">
                    P {formatNumber(totals.protein_g, 1)} g · C{' '}
                    {formatNumber(totals.carbs_g, 1)} g · F{' '}
                    {formatNumber(totals.fat_g, 1)} g
                  </p>
                </CardContent>
              </Card>

              {meals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onEdit={() => setEditing(meal)}
                  onReplaced={() => startTransition(() => router.refresh())}
                />
              ))}
            </TabsContent>
          );
        })}
      </Tabs>

      <Button
        variant="outline"
        size="lg"
        className="mt-6 w-full"
        onClick={generate}
        disabled={generating}
      >
        {generating ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {generating ? 'Regenerating…' : 'Regenerate plan'}
      </Button>

      <EditMealSheet
        meal={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
