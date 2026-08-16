import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { percentOfTarget } from '@/lib/calculations/nutrition';
import type { DayTotals } from '@/types/meal';
import type { NutritionTargets } from '@/types/user';
import { formatNumber } from '@/lib/utils';

const MACROS = [
  { key: 'protein', label: 'Protein', barClass: 'bg-protein' },
  { key: 'carbs', label: 'Carbs', barClass: 'bg-carbs' },
  { key: 'fat', label: 'Fat', barClass: 'bg-fat' },
] as const;

export function MacroBreakdown({
  targets,
  consumed,
}: {
  targets: NutritionTargets;
  consumed: DayTotals;
}) {
  const values = {
    protein: { consumed: consumed.protein_g, target: targets.protein_g },
    carbs: { consumed: consumed.carbs_g, target: targets.carbs_g },
    fat: { consumed: consumed.fat_g, target: targets.fat_g },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Macros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {MACROS.map((macro) => {
          const { consumed: got, target } = values[macro.key];
          const percent = percentOfTarget(got, target);

          return (
            <div key={macro.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{macro.label}</span>
                <span className="tabular text-sm text-muted-foreground">
                  {formatNumber(got, 1)} / {formatNumber(target)} g
                </span>
              </div>
              <Progress
                value={percent}
                indicatorClassName={macro.barClass}
                aria-label={`${macro.label}: ${formatNumber(got, 1)} of ${formatNumber(target)} grams`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
