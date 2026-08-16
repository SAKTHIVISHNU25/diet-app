import type { NextRequest } from 'next/server';
import { ServerValue } from 'firebase-admin/database';
import { apiSuccess, handleRouteError, validationError } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { toEntries } from '@/lib/firebase/converters';
import { mergeEncryptedRecord } from '@/lib/crypto/record-crypto';
import { weightEntrySchema } from '@/lib/validations/progress';
import { normalizeWeightEntry } from '@/lib/data/progress';

/** GET /api/progress — all weigh-ins for the signed-in user, oldest first. */
export async function GET() {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const snapshot = await adminDb().ref(PATHS.weightEntries(auth.user.uid)).get();

    const entries = toEntries(snapshot.val())
      .map(({ id, data }) => normalizeWeightEntry(id, auth.user.uid, data))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

    return apiSuccess({ entries });
  } catch (error) {
    return handleRouteError('progress:get', error);
  }
}

/**
 * POST /api/progress — record a weigh-in.
 *
 * The date is the node key, so writing twice for the same day corrects that
 * day instead of creating a duplicate. That is the Realtime Database
 * equivalent of the old unique constraint, enforced by the shape of the data.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const body: unknown = await request.json().catch(() => null);
    const parsed = weightEntrySchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);

    const ref = adminDb().ref(
      PATHS.weightEntry(auth.user.uid, parsed.data.entry_date),
    );

    const existing = await ref.get();

    // Re-weighing the same day corrects that day's entry, so this is an upsert:
    // merging over the unsealed existing record keeps the old note when the new
    // request omits one, exactly as the previous merge-update did.
    await ref.set(
      mergeEncryptedRecord(
        'weight_entries',
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
        entry: normalizeWeightEntry(
          parsed.data.entry_date,
          auth.user.uid,
          saved.val(),
        ),
      },
      201,
    );
  } catch (error) {
    return handleRouteError('progress:post', error);
  }
}
