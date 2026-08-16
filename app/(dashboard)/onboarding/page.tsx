import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/profile/onboarding-form';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { getProfile } from '@/lib/data/profile';

export const metadata: Metadata = { title: 'Set up your profile' };

// Reads the signed-in user's profile, so it can never be prerendered.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const profile = await getProfile();

  // Already onboarded — nothing to do here.
  if (profile?.onboarded) redirect('/dashboard');

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set you up</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We use these details to estimate your daily calorie and macro targets. You
        can change any of them later.
      </p>

      <OnboardingForm />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
