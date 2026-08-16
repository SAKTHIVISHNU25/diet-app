import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DietPlanClient } from '@/components/diet/diet-plan-client';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
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
      <h1 className="text-2xl font-semibold tracking-tight">Your diet plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Seven days built around {targets.calories} kcal and {targets.protein_g} g of
        protein a day.
      </p>

      <DietPlanClient plan={plan} targets={targets} />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
