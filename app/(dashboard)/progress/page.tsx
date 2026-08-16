import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProgressClient } from '@/components/progress/progress-client';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { PageHeader } from '@/components/shared/page-header';
import { getProfile } from '@/lib/data/profile';
import { getWeightEntries, summarizeProgress } from '@/lib/data/progress';
import { getMotivationQuote } from '@/lib/quotes/zen-quotes';

export const metadata: Metadata = { title: 'Progress' };
export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const [entries, quote] = await Promise.all([
    getWeightEntries(),
    getMotivationQuote(),
  ]);

  const summary = summarizeProgress(
    entries,
    profile.weight_kg,
    profile.target_weight_kg,
    profile.starting_weight_kg,
  );

  return (
    <main className="px-5 py-6">
      <PageHeader title="Progress" description="Track your weight over time." />

      <ProgressClient entries={entries} summary={summary} quote={quote} />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
