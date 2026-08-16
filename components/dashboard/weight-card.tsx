import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  changeTone,
  DeltaPill,
  WeightJourney,
} from '@/components/progress/weight-journey';
import type { ProgressSummary } from '@/types/progress';
import { formatNumber } from '@/lib/utils';

export function WeightCard({ summary }: { summary: ProgressSummary }) {
  const { startingWeight, currentWeight, change, goalWeight, toGoal } = summary;
  const tone = changeTone(change, startingWeight, goalWeight);
  const hasToGoal = toGoal !== null && Math.abs(toGoal) >= 0.1;

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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <p className="tabular text-4xl font-semibold leading-none">
            {currentWeight === null ? '—' : formatNumber(currentWeight, 1)}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              kg
            </span>
          </p>
          <DeltaPill change={change} tone={tone} />
        </div>

        <WeightJourney
          className="mt-5"
          startingWeight={startingWeight}
          currentWeight={currentWeight}
          goalWeight={goalWeight}
        />

        <p className="mt-4 text-sm text-muted-foreground">
          {hasToGoal ? (
            <>
              <span className="tabular font-medium text-foreground">
                {formatNumber(Math.abs(toGoal), 1)} kg
              </span>{' '}
              to your goal
              {goalWeight !== null ? (
                <>
                  {' '}
                  of{' '}
                  <span className="tabular">{formatNumber(goalWeight, 1)} kg</span>
                </>
              ) : null}
              .
            </>
          ) : goalWeight !== null ? (
            <>You&rsquo;re at your goal weight. Nice work.</>
          ) : (
            <>Set a target weight in your profile to track a goal.</>
          )}
        </p>

        {summary.entryCount === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No weigh-ins yet — showing the weight from your profile.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
