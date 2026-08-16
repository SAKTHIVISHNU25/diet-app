import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleUnexpected, validationError } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { nutritionSearchSchema } from '@/lib/validations/food';
import { UsdaError } from '@/lib/usda/client';
import { searchFood } from '@/lib/usda/search';

/**
 * GET /api/nutrition/search?q=chicken&limit=10
 *
 * Searches USDA FoodData Central (falling back to the local cache) and returns
 * normalized per-100 g nutrition. The USDA API key stays on the server.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { searchParams } = request.nextUrl;
    const parsed = nutritionSearchSchema.safeParse({
      q: searchParams.get('q') ?? '',
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) return validationError(parsed.error);

    const { items, source, degraded } = await searchFood(
      parsed.data.q,
      parsed.data.limit,
    );

    if (items.length === 0) {
      return apiError(
        'no_results',
        `No nutrition data found for "${parsed.data.q}". You can enter the values manually.`,
      );
    }

    return apiSuccess({ items, source, degraded: degraded ?? false });
  } catch (error) {
    if (error instanceof UsdaError) {
      console.warn(`[api:nutrition/search] usda ${error.kind}`);

      const code =
        error.kind === 'timeout'
          ? 'provider_timeout'
          : error.kind === 'rate_limited'
            ? 'rate_limited'
            : error.kind === 'not_configured'
              ? 'not_configured'
              : 'provider_unavailable';

      const message =
        error.kind === 'not_configured'
          ? 'Nutrition lookup is not configured. You can enter values manually.'
          : error.kind === 'rate_limited'
            ? 'The nutrition service is busy. Please try again shortly.'
            : 'The nutrition service is unavailable. You can enter values manually.';

      return apiError(code, message);
    }
    return handleUnexpected('nutrition/search', error);
  }
}
