import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProgressClient } from '@/components/progress/progress-client';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { getProfile } from '@/lib/data/profile';
import { getWeightEntries, summarizeProgress } from '@/lib/data/progress';

export const metadata: Metadata = { title: 'Progress' };
export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const entries = await getWeightEntries();
  const summary = summarizeProgress(
    entries,
    profile.weight_kg,
    profile.target_weight_kg,
  );

  return (
    <main className="px-5 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track your weight over time.
      </p>

      <ProgressClient entries={entries} summary={summary} />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
