'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FoodLogList } from '@/components/food/food-log-list';
import { MealIcon } from '@/components/food/meal-icon';
import { MEAL_TYPE_LABELS, type FoodLog, type MealType } from '@/types/meal';
import { cn, formatNumber } from '@/lib/utils';

/** Meal types shown on the dashboard, in the order people eat them. */
const DASHBOARD_MEALS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function MealSections({ logs, date }: { logs: FoodLog[]; date: string }) {
  // Collapsed rather than expanded, so a meal logged after first render is
  // open by default — the interesting state is the one the user closed.
  const [collapsed, setCollapsed] = useState<MealType[]>([]);

  const toggle = (mealType: MealType) =>
    setCollapsed((current) =>
      current.includes(mealType)
        ? current.filter((meal) => meal !== mealType)
        : [...current, mealType],
    );

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
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Today&apos;s meals</CardTitle>
        <Button asChild variant="secondary" size="sm" className="rounded-full">
          <Link href="/scan">
            <Plus aria-hidden />
            Add
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {/* Fixed height, so the card stays the same size all day and a big
            dinner scrolls inside it instead of growing the page. */}
        <div className="scrollbar-slim h-72 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {mealsToShow.map((mealType) => {
            const mealLogs = byMeal.get(mealType) ?? [];
            const label = MEAL_TYPE_LABELS[mealType];

            // An empty meal is one quiet line — nothing to open, nothing to
            // act on. Adding food happens through the one button up top.
            if (mealLogs.length === 0) {
              return (
                <div
                  key={mealType}
                  className="flex items-center gap-3 rounded-xl px-2 py-2"
                >
                  <MealIcon mealType={mealType} muted />
                  <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground/70">Not logged</span>
                </div>
              );
            }

            const calories = mealLogs.reduce((sum, log) => sum + log.calories, 0);
            const isCollapsed = collapsed.includes(mealType);
            const panelId = `meal-panel-${mealType}`;

            return (
              <section
                key={mealType}
                className={cn(
                  'rounded-xl transition-colors',
                  isCollapsed ? '' : 'bg-muted/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(mealType)}
                  aria-expanded={!isCollapsed}
                  aria-controls={panelId}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <MealIcon mealType={mealType} />

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {mealLogs.length} {mealLogs.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>

                  <span className="tabular shrink-0 text-sm font-semibold">
                    {formatNumber(calories)}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      kcal
                    </span>
                  </span>

                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      isCollapsed ? '-rotate-90' : '',
                    )}
                    aria-hidden
                  />
                </button>

                {isCollapsed ? null : (
                  <div id={panelId} className="px-1 pb-1">
                    <FoodLogList logs={mealLogs} />
                  </div>
                )}
              </section>
            );
          })}

          {logs.length === 0 ? (
            <p className="px-2 pt-3 text-sm text-muted-foreground">
              Scan a meal or add a food manually to start tracking today.
            </p>
          ) : null}
        </div>
        <span className="sr-only">Logs shown for {date}</span>
      </CardContent>
    </Card>
  );
}

