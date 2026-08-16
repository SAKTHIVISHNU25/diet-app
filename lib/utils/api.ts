import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Shared API response helpers.
 *
 * Rule: internal error detail (stack traces, upstream error bodies, API keys)
 * never reaches the client. It is logged server-side and replaced with a short
 * friendly message plus a stable machine-readable code.
 */

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_image'
  | 'image_too_large'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'no_results'
  | 'missing_profile'
  | 'not_configured'
  | 'rate_limited'
  | 'database_error'
  | 'internal_error';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  invalid_image: 400,
  image_too_large: 413,
  provider_unavailable: 503,
  provider_timeout: 504,
  no_results: 404,
  missing_profile: 409,
  not_configured: 503,
  rate_limited: 429,
  database_error: 500,
  internal_error: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status: STATUS_BY_CODE[code] },
  );
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function unauthenticated() {
  return apiError('unauthenticated', 'Please sign in to continue.');
}

/** Turns a ZodError into a field-keyed message map safe to show in the UI. */
export function validationError(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return apiError('invalid_request', 'Please check the highlighted fields.', fieldErrors);
}

/**
 * Last-resort handler for a route. Logs the real error, returns a generic one.
 */
export function handleUnexpected(context: string, error: unknown) {
  console.error(`[api:${context}]`, error);
  return apiError(
    'internal_error',
    'Something went wrong on our side. Please try again.',
  );
}

/** Maps a database error to a friendly response. */
export function databaseError(context: string, error: unknown) {
  console.error(`[db:${context}]`, error);
  return apiError('database_error', 'Could not reach the database. Please try again.');
}

/**
 * True for errors thrown by the Firebase Admin SDK, which carry a `code`.
 * Used to tell a database failure apart from a genuine bug in a route.
 */
export function isFirestoreError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'details' in error)
  );
}

/**
 * Single catch-block handler: reports database failures as such, anything else
 * as an internal error. Either way the real error is logged, never returned.
 */
export function handleRouteError(context: string, error: unknown) {
  return isFirestoreError(error)
    ? databaseError(context, error)
    : handleUnexpected(context, error);
}


