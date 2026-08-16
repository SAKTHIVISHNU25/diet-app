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
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Today&apos;s meals</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/scan">
            <Plus aria-hidden />
            Add
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="p-0 pb-2">
        <div className="divide-y">
          {mealsToShow.map((mealType) => {
            const mealLogs = byMeal.get(mealType) ?? [];
            const label = MEAL_TYPE_LABELS[mealType];

            // An empty meal is one quiet tappable line, not a heading plus a
            // paragraph — four of those stacked up is what made this feel busy.
            if (mealLogs.length === 0) {
              return (
                <Link
                  key={mealType}
                  href="/scan"
                  className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Plus className="size-3.5" aria-hidden />
                    Add
                  </span>
                </Link>
              );
            }

            const calories = mealLogs.reduce((sum, log) => sum + log.calories, 0);

            return (
              <section key={mealType} className="px-3 py-3">
                <div className="flex items-baseline justify-between gap-2 px-2">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="tabular text-sm font-medium text-muted-foreground">
                    {formatNumber(calories)}
                    <span className="ml-0.5 text-xs font-normal">kcal</span>
                  </span>
                </div>

                <FoodLogList logs={mealLogs} />
              </section>
            );
          })}
        </div>

        {logs.length === 0 ? (
          <p className="px-5 pb-2 pt-4 text-sm text-muted-foreground">
            Scan a meal or add a food manually to start tracking today.
          </p>
        ) : null}
        <span className="sr-only">Logs shown for {date}</span>
      </CardContent>
    </Card>
  );
}
