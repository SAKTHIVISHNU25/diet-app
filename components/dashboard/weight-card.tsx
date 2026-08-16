import Link from 'next/link';
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProgressSummary } from '@/types/progress';
import { cn, formatNumber } from '@/lib/utils';

export function WeightCard({ summary }: { summary: ProgressSummary }) {
  const { currentWeight, change, goalWeight } = summary;
  const hasChange = change !== null && Math.abs(change) >= 0.1;

  const Icon = !hasChange ? Minus : change! < 0 ? TrendingDown : TrendingUp;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Weight</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/progress">
            Progress
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Current
            </p>
            <p className="tabular text-2xl font-semibold">
              {currentWeight === null ? '—' : `${formatNumber(currentWeight, 1)} kg`}
            </p>
          </div>

          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Since start
            </p>
            <p
              className={cn(
                'tabular flex items-center gap-1 text-lg font-medium',
                !hasChange
                  ? 'text-muted-foreground'
                  : change! < 0
                    ? 'text-primary'
                    : 'text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {hasChange ? `${formatNumber(Math.abs(change!), 1)} kg` : 'No change'}
            </p>
          </div>
        </div>

        {goalWeight !== null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Goal: <span className="tabular">{formatNumber(goalWeight, 1)} kg</span>
            {summary.toGoal !== null && Math.abs(summary.toGoal) >= 0.1 ? (
              <>
                {' '}
                · <span className="tabular">
                  {formatNumber(Math.abs(summary.toGoal), 1)} kg
                </span>{' '}
                to go
              </>
            ) : null}
          </p>
        ) : null}

        {summary.entryCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No weigh-ins yet — showing the weight from your profile.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
