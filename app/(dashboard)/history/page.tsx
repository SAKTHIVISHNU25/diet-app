import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { FoodLogList } from '@/components/food/food-log-list';
import { MEAL_TYPE_LABELS, type MealType } from '@/types/meal';
import { getProfile } from '@/lib/data/profile';
import { getRecentLogsByDate } from '@/lib/data/food-logs';
import { calculateTargets } from '@/lib/calculations/targets';
import { formatNumber, formatRelativeDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];

export default async function HistoryPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const [days, targets] = await Promise.all([
    getRecentLogsByDate(30),
    Promise.resolve(calculateTargets(profile)),
  ]);

  return (
    <main className="px-5 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you logged in the last 30 days.
      </p>

      {days.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nothing logged yet. Scan a meal to start building your history.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {days.map((day) => {
            const byMeal = new Map<MealType, typeof day.logs>();
            for (const log of day.logs) {
              const bucket = byMeal.get(log.meal_type);
              if (bucket) bucket.push(log);
              else byMeal.set(log.meal_type, [log]);
            }

            const overTarget = day.totals.calories > targets.calories;

            return (
              <Card key={day.date}>
                <CardContent className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-medium">{formatRelativeDate(day.date)}</h2>
                    <span className="tabular text-sm text-muted-foreground">
                      {formatNumber(day.totals.calories)} / {formatNumber(targets.calories)}{' '}
                      kcal
                      {overTarget ? ' ⚠' : ''}
                    </span>
                  </div>

                  <p className="tabular mt-0.5 text-xs text-muted-foreground">
                    P {formatNumber(day.totals.protein_g, 1)} g · C{' '}
                    {formatNumber(day.totals.carbs_g, 1)} g · F{' '}
                    {formatNumber(day.totals.fat_g, 1)} g
                  </p>

                  <div className="mt-3 space-y-3">
                    {MEAL_ORDER.filter((meal) => byMeal.has(meal)).map((meal) => (
                      <section key={meal}>
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {MEAL_TYPE_LABELS[meal]}
                        </h3>
                        <FoodLogList logs={byMeal.get(meal)!} />
                      </section>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
