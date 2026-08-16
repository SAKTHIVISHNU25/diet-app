import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DietPlanClient } from '@/components/diet/diet-plan-client';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { PageHeader } from '@/components/shared/page-header';
import { getProfile } from '@/lib/data/profile';
import { getActivePlan } from '@/lib/data/diet-plans';
import { calculateTargets } from '@/lib/calculations/targets';

export const metadata: Metadata = { title: 'Diet plan' };
export const dynamic = 'force-dynamic';

export default async function DietPlanPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const plan = await getActivePlan();
  const targets = calculateTargets(profile);

  return (
    <main className="px-5 py-6">
      <PageHeader
        title="Your diet plan"
        description={
          <>
            Seven days built around {targets.calories} kcal and {targets.protein_g} g
            of protein a day.
          </>
        }
      />

      <DietPlanClient plan={plan} targets={targets} />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
