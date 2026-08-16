import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { FoodLogList } from '@/components/food/food-log-list';
import { MacroDots } from '@/components/food/macro-dots';
import { PageHeader } from '@/components/shared/page-header';
import { MEAL_TYPE_LABELS, type MealType } from '@/types/meal';
import { getProfile } from '@/lib/data/profile';
import { getRecentLogsByDate } from '@/lib/data/food-logs';
import { calculateTargets } from '@/lib/calculations/targets';
import { cn, formatNumber, formatRelativeDate } from '@/lib/utils';

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
      <PageHeader
        title="History"
        description="Everything you logged in the last 30 days."
      />

      {days.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">Nothing logged yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan a meal to start building your history.
              </p>
            </div>
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
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h2 className="font-semibold tracking-tight">
                      {formatRelativeDate(day.date)}
                    </h2>
                    <span
                      className={cn(
                        'tabular text-sm font-medium',
                        overTarget ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatNumber(day.totals.calories)}
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        / {formatNumber(targets.calories)} kcal
                      </span>
                    </span>
                  </div>

                  <MacroDots
                    className="mt-1.5 px-1"
                    protein={day.totals.protein_g}
                    carbs={day.totals.carbs_g}
                    fat={day.totals.fat_g}
                  />

                  <div className="mt-3 divide-y">
                    {MEAL_ORDER.filter((meal) => byMeal.has(meal)).map((meal) => (
                      <section key={meal} className="py-2 first:pt-0 last:pb-0">
                        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
