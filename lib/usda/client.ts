import 'server-only';

import type { UsdaFood, UsdaSearchResponse } from './types';
import { PREFERRED_DATA_TYPES } from './types';

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const REQUEST_TIMEOUT_MS = 10_000;

/** Raised for any USDA failure so callers can distinguish it from a bug. */
export class UsdaError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_configured' | 'unavailable' | 'timeout' | 'rate_limited',
  ) {
    super(message);
    this.name = 'UsdaError';
  }
}

export function isUsdaConfigured(): boolean {
  return Boolean(process.env.USDA_API_KEY);
}

function apiKey(): string {
  const key = process.env.USDA_API_KEY;
  if (!key) {
    throw new UsdaError('USDA_API_KEY is not set', 'not_configured');
  }
  return key;
}

/**
 * Performs a USDA request with a timeout.
 * The API key is sent in a header, never in the URL, so it cannot leak into
 * logs or error messages that echo the request URL.
 */
async function usdaFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${USDA_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
        ...init.headers,
      },
      // USDA reference data is effectively static; cache it at the edge.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (response.status === 429) {
      throw new UsdaError('USDA rate limit reached', 'rate_limited');
    }

    if (!response.ok) {
      // Deliberately not including the response body — it can echo the key.
      throw new UsdaError(`USDA responded with ${response.status}`, 'unavailable');
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof UsdaError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UsdaError('USDA request timed out', 'timeout');
    }
    throw new UsdaError('Could not reach USDA FoodData Central', 'unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

/** Full-text food search. */
export async function searchFoods(query: string, pageSize = 10): Promise<UsdaFood[]> {
  const body = JSON.stringify({
    query,
    pageSize: Math.min(Math.max(pageSize, 1), 50),
    dataType: [...PREFERRED_DATA_TYPES],
    requireAllWords: false,
  });

  const json = (await usdaFetch('/foods/search', {
    method: 'POST',
    body,
  })) as UsdaSearchResponse;

  return json.foods ?? [];
}

/** Fetch a single food by FDC id. Returns null when the id does not exist. */
export async function getFoodById(fdcId: string): Promise<UsdaFood | null> {
  if (!/^\d+$/.test(fdcId)) return null;
  try {
    return (await usdaFetch(`/food/${fdcId}`, { method: 'GET' })) as UsdaFood;
  } catch (error) {
    if (error instanceof UsdaError && error.kind === 'unavailable') return null;
    throw error;
  }
}
