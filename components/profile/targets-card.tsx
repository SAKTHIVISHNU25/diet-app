import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionTargets } from '@/types/user';
import { cn, formatNumber } from '@/lib/utils';

/** Shows the derived numbers and, briefly, where they come from. */
export function TargetsCard({
  targets,
  className,
}: {
  targets: NutritionTargets;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your daily targets</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <Row label="Calories" value={`${formatNumber(targets.calories)} kcal`} emphasis />
          <Row label="Protein" value={`${formatNumber(targets.protein_g)} g`} />
          <Row label="Carbs" value={`${formatNumber(targets.carbs_g)} g`} />
          <Row label="Fat" value={`${formatNumber(targets.fat_g)} g`} />
        </dl>

        <div className="mt-5 border-t pt-4">
          <dl className="grid grid-cols-2 gap-4">
            <Row label="BMR" value={`${formatNumber(targets.bmr)} kcal`} muted />
            <Row label="TDEE" value={`${formatNumber(targets.tdee)} kcal`} muted />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            BMR uses the Mifflin-St Jeor equation. TDEE applies an activity
            multiplier, and your calorie target adjusts TDEE for your goal. All of
            these are population estimates — your real needs may differ.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular mt-0.5 font-medium',
          emphasis ? 'text-xl text-primary' : 'text-base',
          muted ? 'text-muted-foreground' : '',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
