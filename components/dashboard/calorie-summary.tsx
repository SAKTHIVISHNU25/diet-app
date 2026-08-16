import { Card, CardContent } from '@/components/ui/card';
import { percentOfTarget, rawPercent, remainingCalories } from '@/lib/calculations/nutrition';
import { cn, formatNumber } from '@/lib/utils';

/**
 * The headline card: a ring showing progress toward today's calorie target.
 *
 * The ring is decorative — every number it encodes is also present as text, so
 * the card is fully usable by screen readers and does not rely on colour alone.
 */
export function CalorieSummary({
  target,
  consumed,
}: {
  target: number;
  consumed: number;
}) {
  const remaining = remainingCalories(target, consumed);
  const percent = percentOfTarget(consumed, target);
  const actualPercent = rawPercent(consumed, target);
  const isOver = remaining < 0;

  // Ring geometry: r=52 in a 120x120 box.
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <Card>
      <CardContent className="flex items-center gap-5 p-5">
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="stroke-secondary"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90 60 60)"
              className={cn(
                'transition-[stroke-dasharray] duration-700',
                isOver ? 'stroke-destructive' : 'stroke-primary',
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-2xl font-semibold leading-none">
              {formatNumber(consumed)}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              of {formatNumber(target)}
            </span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Target
            </dt>
            <dd className="tabular text-lg font-medium">
              {formatNumber(target)} kcal
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {isOver ? 'Over target' : 'Remaining'}
            </dt>
            <dd
              className={cn(
                'tabular text-lg font-medium',
                isOver ? 'text-destructive' : 'text-primary',
              )}
            >
              {formatNumber(Math.abs(remaining))} kcal
            </dd>
          </div>
          <p className="text-xs text-muted-foreground">
            {actualPercent}% of your daily target
          </p>
        </dl>
      </CardContent>
    </Card>
  );
}
