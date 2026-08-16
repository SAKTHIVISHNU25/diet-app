'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeightEntry } from '@/types/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateShort, formatNumber } from '@/lib/utils';

/**
 * Weight trend.
 *
 * The Y axis is deliberately zoomed to the data range rather than anchored at
 * zero — for weight, the shape of the change is what matters, and a zero-based
 * axis would flatten it into a meaningless line.
 */
export function WeightChart({
  entries,
  goalWeight,
}: {
  entries: WeightEntry[];
  goalWeight: number | null;
}) {
  if (entries.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">Not enough data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add at least two weigh-ins to see your trend.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = entries.map((entry) => ({
    date: entry.entry_date,
    label: formatDateShort(entry.entry_date),
    weight: entry.weight_kg,
  }));

  const weights = entries.map((entry) => entry.weight_kg);
  const relevant = goalWeight !== null ? [...weights, goalWeight] : weights;
  const min = Math.min(...relevant);
  const max = Math.max(...relevant);
  const padding = Math.max(1, (max - min) * 0.15);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trend</CardTitle>
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                minTickGap={24}
              />
              <YAxis
                domain={[
                  Math.floor(min - padding),
                  Math.ceil(max + padding),
                ]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={40}
                unit="kg"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: '0.8125rem',
                }}
                formatter={(value: number) => [`${formatNumber(value, 1)} kg`, 'Weight']}
              />
              {goalWeight !== null ? (
                <ReferenceLine
                  y={goalWeight}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Goal',
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
