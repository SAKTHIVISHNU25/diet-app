import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ScanClient } from '@/components/food/scan-client';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { PageHeader } from '@/components/shared/page-header';
import { getProfile } from '@/lib/data/profile';
import { toISODate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Scan food' };

// Reads the signed-in user's profile, so it can never be prerendered.
export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  return (
    <main className="px-5 py-6">
      <PageHeader
        title="Scan food"
        description="Take a photo or choose one from your gallery. You confirm the result before anything is added to your log."
      />

      <ScanClient today={toISODate()} />

      <MedicalDisclaimer className="mt-8" />
    </main>
  );
}
