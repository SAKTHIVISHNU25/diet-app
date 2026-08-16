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
import { weightEntryUpdateSchema } from '@/lib/validations/progress';
import { normalizeWeightEntry } from '@/lib/data/progress';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** For weight entries the id IS the date, so it must look like one. */
function isValidDateKey(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id);
}

/** PATCH /api/progress/[id] */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidDateKey(id)) {
      return apiError('not_found', 'That weight entry no longer exists.');
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = weightEntryUpdateSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return apiError('invalid_request', 'Nothing to update.');
    }

    const db = adminDb();
    const ref = db.ref(PATHS.weightEntry(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That weight entry no longer exists.');
    }

    const newDate = parsed.data.entry_date;

    // The key encodes the date, so changing the date means moving the node.
    // A multi-path update makes the move atomic, and writing to the target key
    // applies the same one-weigh-in-per-day rule as the create path.
    if (newDate && newDate !== id) {
      // The ciphertext is sealed against its record id, so a move is not a
      // copy: unseal under the old date, reseal under the new one. Carrying the
      // blob across verbatim would produce a record that no longer decrypts.
      const current = decryptRecord('weight_entries', auth.user.uid, id, existing.val());

      await db.ref(PATHS.weightEntries(auth.user.uid)).update({
        [newDate]: encryptRecord('weight_entries', auth.user.uid, newDate, {
          ...current,
          ...parsed.data,
          updated_at: ServerValue.TIMESTAMP,
        }),
        [id]: null,
      });

      const moved = await db.ref(PATHS.weightEntry(auth.user.uid, newDate)).get();
      return apiSuccess({
        entry: normalizeWeightEntry(newDate, auth.user.uid, moved.val()),
      });
    }

    await ref.set(
      mergeEncryptedRecord('weight_entries', auth.user.uid, id, existing.val(), {
        ...parsed.data,
        updated_at: ServerValue.TIMESTAMP,
      }),
    );

    const updated = await ref.get();
    return apiSuccess({
      entry: normalizeWeightEntry(id, auth.user.uid, updated.val()),
    });
  } catch (error) {
    return handleRouteError('progress:patch', error);
  }
}

/** DELETE /api/progress/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidDateKey(id)) {
      return apiError('not_found', 'That weight entry no longer exists.');
    }

    const ref = adminDb().ref(PATHS.weightEntry(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That weight entry no longer exists.');
    }

    await ref.remove();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError('progress:delete', error);
  }
}
