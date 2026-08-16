import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/shared/mobile-nav';
import { InstallPrompt } from '@/components/shared/install-prompt';
import { WelcomeTour } from '@/components/shared/welcome-tour';
import { TimezoneSync } from '@/components/shared/timezone-sync';
import { getProfile } from '@/lib/data/profile';
import { getUserTimeZone } from '@/lib/date/server';
import { getSessionUser } from '@/lib/firebase/server';

/**
 * Shell for every signed-in page.
 *
 * This is where the session is genuinely *verified*. The middleware only checks
 * that a session cookie exists — it runs on the Edge runtime, where the
 * Firebase Admin SDK cannot. So this check is the real gate: no user data is
 * rendered without a cryptographically verified, non-revoked session.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // `getProfile` is React-cached, so this shares the read the child page
  // already makes for its own onboarding guard — no extra round trip.
  const profile = await getProfile();

  // What the server *thinks* the user's zone is; the client corrects it below
  // and re-renders if they disagree.
  const serverTimeZone = await getUserTimeZone();

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-2xl pb-safe-nav">{children}</div>
      <TimezoneSync serverTimeZone={serverTimeZone} />
      <MobileNav />
      <InstallPrompt />
      <WelcomeTour onboarded={profile?.onboarded === true} />
    </div>
  );
}
