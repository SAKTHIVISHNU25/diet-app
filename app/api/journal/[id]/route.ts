import type { NextRequest } from 'next/server';
import { ServerValue } from 'firebase-admin/database';
import {
  apiError,
  apiSuccess,
  handleRouteError,
  validationError,
} from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import {
  decryptRecord,
  encryptRecord,
  mergeEncryptedRecord,
} from '@/lib/crypto/record-crypto';
import { journalEntryUpdateSchema } from '@/lib/validations/journal';
import { normalizeJournalEntry } from '@/lib/data/journal';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** For journal entries the id IS the date, so it must look like one. */
function isValidDateKey(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id);
}

/** PATCH /api/journal/[id] */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidDateKey(id)) {
      return apiError('not_found', 'That journal entry no longer exists.');
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = journalEntryUpdateSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return apiError('invalid_request', 'Nothing to update.');
    }

    const db = adminDb();
    const ref = db.ref(PATHS.journalEntry(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That journal entry no longer exists.');
    }

    const newDate = parsed.data.entry_date;

    // The key encodes the date, so re-dating an entry means moving the node.
    // A multi-path update makes the move atomic, and writing to the target key
    // applies the same one-entry-per-day rule as the create path.
    if (newDate && newDate !== id) {
      // Ciphertext is sealed against its record id, so the blob cannot be
      // carried across verbatim — unseal under the old date, reseal under the
      // new one, or the moved record would no longer decrypt.
      const current = decryptRecord('journal_entries', auth.user.uid, id, existing.val());

      await db.ref(PATHS.journalEntries(auth.user.uid)).update({
        [newDate]: encryptRecord('journal_entries', auth.user.uid, newDate, {
          ...current,
          ...parsed.data,
          updated_at: ServerValue.TIMESTAMP,
        }),
        [id]: null,
      });

      const moved = await db.ref(PATHS.journalEntry(auth.user.uid, newDate)).get();
      return apiSuccess({
        entry: normalizeJournalEntry(newDate, auth.user.uid, moved.val()),
      });
    }

    await ref.set(
      mergeEncryptedRecord('journal_entries', auth.user.uid, id, existing.val(), {
        ...parsed.data,
        updated_at: ServerValue.TIMESTAMP,
      }),
    );

    const updated = await ref.get();
    return apiSuccess({
      entry: normalizeJournalEntry(id, auth.user.uid, updated.val()),
    });
  } catch (error) {
    return handleRouteError('journal:patch', error);
  }
}

/** DELETE /api/journal/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidDateKey(id)) {
      return apiError('not_found', 'That journal entry no longer exists.');
    }

    const ref = adminDb().ref(PATHS.journalEntry(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That journal entry no longer exists.');
    }

    await ref.remove();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError('journal:delete', error);
  }
}
