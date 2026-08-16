import type { NextRequest } from 'next/server';
import { ServerValue } from 'firebase-admin/database';
import { apiSuccess, handleRouteError, validationError } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { toEntries } from '@/lib/firebase/converters';
import { mergeEncryptedRecord } from '@/lib/crypto/record-crypto';
import { journalEntrySchema } from '@/lib/validations/journal';
import { normalizeJournalEntry } from '@/lib/data/journal';

/** GET /api/journal — every entry for the signed-in user, newest first. */
export async function GET() {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const snapshot = await adminDb().ref(PATHS.journalEntries(auth.user.uid)).get();

    const entries = toEntries(snapshot.val())
      .map(({ id, data }) => normalizeJournalEntry(id, auth.user.uid, data))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

    return apiSuccess({ entries });
  } catch (error) {
    return handleRouteError('journal:get', error);
  }
}

/**
 * POST /api/journal — write today's (or any day's) entry.
 *
 * The date is the node key, so posting twice for the same day rewrites that
 * day instead of creating a second entry — the same one-per-day rule the
 * weigh-in route relies on.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const body: unknown = await request.json().catch(() => null);
    const parsed = journalEntrySchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);

    const ref = adminDb().ref(
      PATHS.journalEntry(auth.user.uid, parsed.data.entry_date),
    );

    const existing = await ref.get();

    await ref.set(
      mergeEncryptedRecord(
        'journal_entries',
        auth.user.uid,
        parsed.data.entry_date,
        existing.val(),
        {
          ...parsed.data,
          created_at: existing.exists()
            ? (existing.val()?.created_at ?? ServerValue.TIMESTAMP)
            : ServerValue.TIMESTAMP,
          updated_at: ServerValue.TIMESTAMP,
        },
      ),
    );

    const saved = await ref.get();
    return apiSuccess(
      {
        entry: normalizeJournalEntry(
          parsed.data.entry_date,
          auth.user.uid,
          saved.val(),
        ),
      },
      201,
    );
  } catch (error) {
    return handleRouteError('journal:post', error);
  }
}
