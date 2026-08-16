/**
 * Constants shared between the Edge middleware and the Node server code.
 *
 * Separate from `server.ts` so middleware can import the cookie name without
 * pulling in `firebase-admin`, which cannot run on the Edge runtime.
 */

export const SESSION_COOKIE_NAME = '__session';

/** Two weeks — the maximum Firebase allows for a session cookie. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000;
