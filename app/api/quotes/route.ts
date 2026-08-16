import { apiSuccess, handleRouteError } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { getMotivationQuote } from '@/lib/quotes/zen-quotes';

/**
 * GET /api/quotes — one motivational quote.
 *
 * Dynamic so every call re-picks from the pool; the upstream fetch behind it
 * is cached, so this does not hit ZenQuotes on each request.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    return apiSuccess({ quote: await getMotivationQuote() });
  } catch (error) {
    return handleRouteError('quotes:get', error);
  }
}
