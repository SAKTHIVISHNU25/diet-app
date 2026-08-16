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
import { stripUndefined } from '@/lib/firebase/converters';
import { foodLogUpdateSchema } from '@/lib/validations/food';
import { normalizeFoodLog } from '@/lib/data/food-logs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Ownership needs no explicit check: the path is built from the verified
 * session's uid, so `food_logs/{uid}/{id}` can only address the caller's own
 * entry. An id belonging to someone else does not exist here, and returns 404.
 */

/** PATCH /api/food/log/[id] */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidKey(id)) {
      return apiError('not_found', 'That food entry no longer exists.');
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = foodLogUpdateSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return apiError('invalid_request', 'Nothing to update.');
    }

    const ref = adminDb().ref(PATHS.foodLog(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That food entry no longer exists.');
    }

    await ref.update(
      stripUndefined({ ...parsed.data, updated_at: ServerValue.TIMESTAMP }),
    );

    const updated = await ref.get();
    return apiSuccess({ log: normalizeFoodLog(id, auth.user.uid, updated.val()) });
  } catch (error) {
    return handleRouteError('food/log:patch', error);
  }
}

/** DELETE /api/food/log/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!isValidKey(id)) {
      return apiError('not_found', 'That food entry no longer exists.');
    }

    const ref = adminDb().ref(PATHS.foodLog(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That food entry no longer exists.');
    }

    await ref.remove();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError('food/log:delete', error);
  }
}

/**
 * Realtime Database keys cannot contain . $ # [ ] or /. A path built from an
 * unchecked id could otherwise escape the intended node.
 */
function isValidKey(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}
