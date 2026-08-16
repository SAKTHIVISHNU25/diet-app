import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { JournalClient } from '@/components/journal/journal-client';
import { PageHeader } from '@/components/shared/page-header';
import { getProfile } from '@/lib/data/profile';
import { getJournalEntries, summarizeJournal } from '@/lib/data/journal';
import { getUserToday } from '@/lib/date/server';
import { getMotivationQuote } from '@/lib/quotes/zen-quotes';

export const metadata: Metadata = { title: 'Journal' };
export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const profile = await getProfile();
  if (!profile?.onboarded) redirect('/onboarding');

  const [entries, quote, today] = await Promise.all([
    getJournalEntries(),
    getMotivationQuote(),
    getUserToday(),
  ]);

  const summary = summarizeJournal(entries, today);

  return (
    <main className="px-5 py-6">
      <PageHeader
        title="Journal"
        description="How the day went, in your own words."
      />

      <JournalClient entries={entries} summary={summary} quote={quote} />
    </main>
  );
}
