import type { NextRequest } from 'next/server';
import { ServerValue } from 'firebase-admin/database';
import { apiSuccess, handleRouteError, validationError } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { toEntries } from '@/lib/firebase/converters';
import { encryptRecord } from '@/lib/crypto/record-crypto';
import { foodLogBatchSchema } from '@/lib/validations/food';
import { normalizeFoodLog } from '@/lib/data/food-logs';

/**
 * POST /api/food/log — create one or more food log entries.
 *
 * The write path is derived from the verified session's uid, never from the
 * request body, so a client cannot write into another account's subtree.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const body: unknown = await request.json().catch(() => null);
    const parsed = foodLogBatchSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);

    const listRef = adminDb().ref(PATHS.foodLogs(auth.user.uid));

    // A multi-path update is atomic: either every log in the batch is written,
    // or none is.
    const updates: Record<string, unknown> = {};
    const ids: string[] = [];

    for (const item of parsed.data.items) {
      const id = listRef.push().key;
      if (!id) continue;
      ids.push(id);
      // Only `log_date` and the timestamps survive as plaintext; the food
      // name, portion and nutrition are sealed into `enc`. Sealing is bound to
      // this uid and this id, so the row cannot be relocated. (`encryptRecord`
      // drops undefined values, which is what `stripUndefined` did here.)
      updates[id] = encryptRecord('food_logs', auth.user.uid, id, {
        ...item,
        created_at: ServerValue.TIMESTAMP,
        updated_at: ServerValue.TIMESTAMP,
      });
    }

    await listRef.update(updates);

    // ServerValue.TIMESTAMP resolves server-side, so read back rather than
    // returning the placeholder to the client.
    const snapshot = await listRef.get();
    const byId = new Map(toEntries(snapshot.val()).map(({ id, data }) => [id, data]));

    const logs = ids
      .filter((id) => byId.has(id))
      .map((id) => normalizeFoodLog(id, auth.user.uid, byId.get(id)));

    return apiSuccess({ logs }, 201);
  } catch (error) {
    return handleRouteError('food/log:post', error);
  }
}

/** GET /api/food/log?date=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const date = request.nextUrl.searchParams.get('date');
    const listRef = adminDb().ref(PATHS.foodLogs(auth.user.uid));

    const snapshot =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? await listRef.orderByChild('log_date').equalTo(date).get()
        : await listRef.get();

    const logs = toEntries(snapshot.val())
      .map(({ id, data }) => normalizeFoodLog(id, auth.user.uid, data))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    return apiSuccess({ logs });
  } catch (error) {
    return handleRouteError('food/log:get', error);
  }
}
