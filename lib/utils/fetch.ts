import type { ApiErrorBody } from './api';

/**
 * Extract a user-facing message from a failed API response.
 *
 * The API always returns { error: { code, message } }, but a proxy or a crash
 * can produce something else — so this never assumes and always has a fallback.
 */
export async function readApiError(
  response: Response,
  fallback = 'Something went wrong. Please try again.',
): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    const message = body?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  } catch {
    return fallback;
  }
}

/** Field-level validation errors returned alongside an `invalid_request`. */
export async function readFieldErrors(
  response: Response,
): Promise<Record<string, string> | null> {
  try {
    const body = (await response.clone().json()) as Partial<ApiErrorBody>;
    const details = body?.error?.details;
    return details && typeof details === 'object'
      ? (details as Record<string, string>)
      : null;
  } catch {
    return null;
  }
}
