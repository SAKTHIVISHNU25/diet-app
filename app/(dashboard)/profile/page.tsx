import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ProfileForm } from '@/components/profile/profile-form';
import { TargetsCard } from '@/components/profile/targets-card';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { NotificationsCard } from '@/components/profile/notifications-card';
import { PageHeader } from '@/components/shared/page-header';
import { ThemeToggle } from '@/components/theme/theme-toggle';
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
      <PageHeader title="Profile" description={user?.email} />

      <TargetsCard targets={targets} className="mt-6" />

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Changing these recalculates your targets.
      </p>

      <ProfileForm profile={profile} />

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Reminders are stored on this device, not on your account.
      </p>
      <NotificationsCard className="mt-3" />

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        System follows your device&apos;s light or dark setting.
      </p>
      <ThemeToggle className="mt-3" />

      <div className="mt-8">
        <SignOutButton />
      </div>

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
