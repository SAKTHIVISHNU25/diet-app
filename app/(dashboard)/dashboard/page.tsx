import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, CalendarDays, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalorieSummary } from '@/components/dashboard/calorie-summary';
import { MacroBreakdown } from '@/components/dashboard/macro-breakdown';
import { MealSections } from '@/components/dashboard/meal-sections';
import { WeightCard } from '@/components/dashboard/weight-card';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { PageHeader } from '@/components/shared/page-header';
import { ThemeToggleButton } from '@/components/theme/theme-toggle-button';
import { calculateTargets } from '@/lib/calculations/targets';
import { sumNutrition } from '@/lib/calculations/nutrition';
import { getProfile } from '@/lib/data/profile';
import { getLogsForDate } from '@/lib/data/food-logs';
import { getWeightEntries, summarizeProgress } from '@/lib/data/progress';
import { formatRelativeDate, toISODate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

// Always render fresh — the day's totals change as the user logs food.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getProfile();

  // No profile yet means signup completed but onboarding did not.
  if (!profile || !profile.onboarded) redirect('/onboarding');

  const today = toISODate();
  const [logs, weightEntries] = await Promise.all([
    getLogsForDate(today),
    getWeightEntries(),
  ]);

  const targets = calculateTargets(profile);
  const consumed = sumNutrition(logs);
  const progress = summarizeProgress(
    weightEntries,
    profile.weight_kg,
    profile.target_weight_kg,
    profile.starting_weight_kg,
  );

  const firstName = profile.full_name.split(' ')[0] || 'there';

  return (
    <main className="px-5 py-6">
      <PageHeader
        eyebrow={formatRelativeDate(today)}
        title={`Hi, ${firstName}`}
        action={
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <Button asChild variant="ghost" size="icon" aria-label="Profile settings">
              <Link href="/profile">
                <Settings className="size-5" aria-hidden />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-4">
        <CalorieSummary target={targets.calories} consumed={consumed.calories} />

        <MacroBreakdown targets={targets} consumed={consumed} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg" className="h-14 text-base">
            <Link href="/scan">
              <Camera aria-hidden />
              Scan food
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 text-base">
            <Link href="/diet-plan">
              <CalendarDays aria-hidden />
              View diet plan
            </Link>
          </Button>
        </div>

        <MealSections logs={logs} date={today} />

        <WeightCard summary={progress} />

        <MedicalDisclaimer />
      </div>
    </main>
  );
}
