import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FoodLogList } from '@/components/food/food-log-list';
import { MEAL_TYPE_LABELS, type FoodLog, type MealType } from '@/types/meal';
import { formatNumber } from '@/lib/utils';

/** Meal types shown on the dashboard, in the order people eat them. */
const DASHBOARD_MEALS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function MealSections({ logs, date }: { logs: FoodLog[]; date: string }) {
  const byMeal = new Map<MealType, FoodLog[]>();
  for (const log of logs) {
    const bucket = byMeal.get(log.meal_type);
    if (bucket) bucket.push(log);
    else byMeal.set(log.meal_type, [log]);
  }

  // "Other" only appears once something is filed under it.
  const mealsToShow: MealType[] = [
    ...DASHBOARD_MEALS,
    ...(byMeal.has('other') ? (['other'] as MealType[]) : []),
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Today&apos;s meals</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/scan">
            <Plus aria-hidden />
            Add
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pb-2">
        {mealsToShow.map((mealType) => {
          const mealLogs = byMeal.get(mealType) ?? [];
          const calories = mealLogs.reduce((sum, log) => sum + log.calories, 0);

          return (
            <section key={mealType} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium">{MEAL_TYPE_LABELS[mealType]}</h3>
                <span className="tabular text-sm text-muted-foreground">
                  {formatNumber(calories)} kcal
                </span>
              </div>

              {mealLogs.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nothing logged yet</p>
              ) : (
                <FoodLogList logs={mealLogs} />
              )}
            </section>
          );
        })}

        {logs.length === 0 ? (
          <p className="px-5 pb-3 pt-1 text-sm text-muted-foreground">
            Scan a meal or add a food manually to start tracking today.
          </p>
        ) : null}
        <span className="sr-only">Logs shown for {date}</span>
      </CardContent>
    </Card>
  );
}
