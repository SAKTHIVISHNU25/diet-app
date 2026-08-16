import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

/** A change smaller than this is rounding noise on a bathroom scale. */
const NOISE_KG = 0.1;

export type ChangeTone = 'good' | 'off-track' | 'neutral';

/**
 * Is the change moving the user toward their goal?
 *
 * The goal decides the direction — someone bulking wants the number to go up,
 * so "lost weight" is not universally good. With no goal set we fall back to
 * treating loss as the intended direction.
 */
export function changeTone(
  change: number | null,
  startingWeight: number | null,
  goalWeight: number | null,
): ChangeTone {
  if (change === null || Math.abs(change) < NOISE_KG) return 'neutral';

  if (
    startingWeight !== null &&
    goalWeight !== null &&
    Math.abs(goalWeight - startingWeight) >= NOISE_KG
  ) {
    return Math.sign(change) === Math.sign(goalWeight - startingWeight)
      ? 'good'
      : 'off-track';
  }

  return change < 0 ? 'good' : 'off-track';
}

/**
 * How far along the start → goal journey the current weight sits, 0–100.
 * Returns null when there is nothing meaningful to plot.
 */
export function goalProgressPercent(
  startingWeight: number | null,
  currentWeight: number | null,
  goalWeight: number | null,
): number | null {
  if (startingWeight === null || currentWeight === null || goalWeight === null) {
    return null;
  }
  const span = goalWeight - startingWeight;
  if (Math.abs(span) < NOISE_KG) return null;

  const percent = ((currentWeight - startingWeight) / span) * 100;
  return Math.min(100, Math.max(0, percent));
}

export function DeltaPill({
  change,
  tone,
  className,
}: {
  change: number | null;
  tone: ChangeTone;
  className?: string;
}) {
  // Nothing to celebrate when the number hasn't moved — say it quietly, as
  // plain small text rather than a chip competing with the weight itself.
  if (tone === 'neutral' || change === null) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        No change yet
      </span>
    );
  }

  const Icon = change < 0 ? TrendingDown : TrendingUp;

  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'good' ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {change < 0 ? '−' : '+'}
      {formatNumber(Math.abs(change), 1)} kg
    </span>
  );
}

/**
 * The start → goal track with a marker at the current weight.
 *
 * Decorative: every value it encodes is also spelled out in the labels beneath
 * it, so nothing depends on reading the bar.
 */
export function WeightJourney({
  startingWeight,
  currentWeight,
  goalWeight,
  className,
}: {
  startingWeight: number | null;
  currentWeight: number | null;
  goalWeight: number | null;
  className?: string;
}) {
  const percent = goalProgressPercent(startingWeight, currentWeight, goalWeight);
  if (percent === null) return null;

  // Keep the marker fully inside the track at the extremes.
  const markerLeft = Math.min(97, Math.max(3, percent));

  return (
    <div className={className}>
      <div className="relative h-2.5" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-secondary" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm transition-[left] duration-700"
          style={{ left: `${markerLeft}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="tabular">
          Start {formatNumber(startingWeight!, 1)} kg
        </span>
        <span className="font-medium text-foreground">
          {Math.round(percent)}% there
        </span>
        <span className="tabular">Goal {formatNumber(goalWeight!, 1)} kg</span>
      </div>
    </div>
  );
}
