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
import { updatePlanMealSchema } from '@/lib/validations/diet-plan';
import { normalizePlanMeal } from '@/lib/data/diet-plans';
import { totalsFor } from '@/lib/diet/totals';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/diet-plan/meal/[id]
 *
 * Edits a planned meal. When `foods` is supplied the meal's totals are
 * recomputed server-side from it — the client cannot set totals that disagree
 * with the food list.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      return apiError('not_found', 'That meal no longer exists.');
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = updatePlanMealSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return apiError('invalid_request', 'Nothing to update.');
    }

    const ref = adminDb().ref(PATHS.dietPlanMeal(auth.user.uid, id));
    const existing = await ref.get();

    if (!existing.exists()) {
      return apiError('not_found', 'That meal no longer exists.');
    }

    const update: Record<string, unknown> = { updated_at: ServerValue.TIMESTAMP };
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.meal_type !== undefined) update.meal_type = parsed.data.meal_type;

    if (parsed.data.foods !== undefined) {
      update.foods = parsed.data.foods;
      Object.assign(update, totalsFor(parsed.data.foods));
    }

    await ref.update(stripUndefined(update));

    const updated = await ref.get();
    return apiSuccess({ meal: normalizePlanMeal(id, auth.user.uid, updated.val()) });
  } catch (error) {
    return handleRouteError('diet-plan/meal:patch', error);
  }
}
