import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ProfileForm } from '@/components/profile/profile-form';
import { TargetsCard } from '@/components/profile/targets-card';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { getProfile } from '@/lib/data/profile';
import { calculateTargets } from '@/lib/calculations/targets';
import { getSessionUser } from '@/lib/firebase/server';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);
  if (!profile?.onboarded) redirect('/onboarding');

  const targets = calculateTargets(profile);

  return (
    <main className="px-5 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <TargetsCard targets={targets} className="mt-6" />

      <h2 className="mt-8 text-lg font-semibold">Your details</h2>
      <p className="text-sm text-muted-foreground">
        Changing these recalculates your targets.
      </p>

      <ProfileForm profile={profile} />

      <div className="mt-8">
        <SignOutButton />
      </div>

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
