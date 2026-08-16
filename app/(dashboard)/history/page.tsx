import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { FoodLogList } from '@/components/food/food-log-list';
import { MacroDots } from '@/components/food/macro-dots';
import { MealIcon } from '@/components/food/meal-icon';
import { PageHeader } from '@/components/shared/page-header';
import { MEAL_TYPE_LABELS, type MealType } from '@/types/meal';
import { getProfile } from '@/lib/data/profile';
import { getRecentLogsByDate } from '@/lib/data/food-logs';
import { getUserToday } from '@/lib/date/server';
import { calculateTargets } from '@/lib/calculations/targets';
import {
  cn,
  clamp,
  formatDateShort,
  formatNumber,
  formatRelativeDate,
} from '@/lib/utils';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];

export default async function HistoryPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const [days, today, targets] = await Promise.all([
    getRecentLogsByDate(30),
    getUserToday(),
    Promise.resolve(calculateTargets(profile)),
  ]);

  const averageCalories =
    days.length === 0
      ? 0
      : days.reduce((sum, day) => sum + day.totals.calories, 0) / days.length;
  const averageProtein =
    days.length === 0
      ? 0
      : days.reduce((sum, day) => sum + day.totals.protein_g, 0) / days.length;

  return (
    <main className="px-5 py-6">
      <PageHeader
        title="History"
        description="Everything you logged in the last 30 days."
      />

      {days.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <CalendarDays className="size-6" aria-hidden />
            </span>
            <p className="mt-4 font-medium">Nothing logged yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scan a meal to start building your history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* The 30-day shape at a glance, so the page opens with an answer
              rather than with a wall of individual meals. */}
          <Card className="mt-6">
            <CardContent className="grid grid-cols-3 gap-3 p-4 text-center">
              <Summary label="Days logged" value={formatNumber(days.length)} />
              <Summary
                label="Avg calories"
                value={formatNumber(averageCalories)}
                unit="kcal"
                highlight
              />
              <Summary
                label="Avg protein"
                value={formatNumber(averageProtein)}
                unit="g"
              />
            </CardContent>
          </Card>

          <div className="mt-4 space-y-4">
            {days.map((day) => {
              const byMeal = new Map<MealType, typeof day.logs>();
              for (const log of day.logs) {
                const bucket = byMeal.get(log.meal_type);
                if (bucket) bucket.push(log);
                else byMeal.set(log.meal_type, [log]);
              }

              const overTarget = day.totals.calories > targets.calories;
              const percent = targets.calories
                ? clamp((day.totals.calories / targets.calories) * 100, 0, 100)
                : 0;

              return (
                <Card key={day.date} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <h2 className="font-semibold tracking-tight">
                          {formatRelativeDate(day.date, today)}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateShort(day.date)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'tabular text-lg font-semibold leading-none',
                            overTarget ? 'text-destructive' : 'text-foreground',
                          )}
                        >
                          {formatNumber(day.totals.calories)}
                        </p>
                        <p className="tabular mt-1 text-xs text-muted-foreground">
                          of {formatNumber(targets.calories)} kcal
                        </p>
                      </div>
                    </div>

                    {/* Progress against the day's target — the single number
                        people scan a history list for. */}
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${formatNumber(day.totals.calories)} of ${formatNumber(
                        targets.calories,
                      )} kcal`}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full',
                          overTarget ? 'bg-destructive' : 'bg-primary',
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <MacroDots
                      className="mt-2.5 px-1"
                      protein={day.totals.protein_g}
                      carbs={day.totals.carbs_g}
                      fat={day.totals.fat_g}
                    />

                    <div className="mt-3 space-y-1">
                      {MEAL_ORDER.filter((meal) => byMeal.has(meal)).map((meal) => {
                        const mealLogs = byMeal.get(meal)!;
                        const mealCalories = mealLogs.reduce(
                          (sum, log) => sum + log.calories,
                          0,
                        );

                        return (
                          <section key={meal} className="rounded-xl bg-muted/30">
                            <div className="flex items-center gap-3 px-2 py-2">
                              <MealIcon mealType={meal} className="size-7" />
                              <h3 className="flex-1 text-sm font-semibold">
                                {MEAL_TYPE_LABELS[meal]}
                              </h3>
                              <span className="tabular text-sm font-medium text-muted-foreground">
                                {formatNumber(mealCalories)}
                                <span className="ml-0.5 text-xs font-normal">
                                  kcal
                                </span>
                              </span>
                            </div>

                            <div className="px-1 pb-1">
                              <FoodLogList logs={mealLogs} />
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

function Summary({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
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
        {value}
        {unit ? (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}
