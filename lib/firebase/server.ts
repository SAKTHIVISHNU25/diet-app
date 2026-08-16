import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';
import { adminAuth } from './admin';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from './session-constants';

/**
 * Server-side session handling.
 *
 * Firebase Auth is a client-side SDK, so it has no server session of its own.
 * The bridge is a Firebase **session cookie**:
 *
 *   1. The client signs in and receives an ID token (valid ~1 hour).
 *   2. It POSTs that token to /api/auth/session.
 *   3. The server exchanges it for a session cookie via the Admin SDK and sets
 *      it httpOnly, so JavaScript cannot read it.
 *   4. Server Components and route handlers verify that cookie every request.
 *
 * This is what keeps pages as Server Components with data already rendered,
 * rather than a client-side fetch waterfall.
 */

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from './session-constants';

export interface SessionUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * The verified user for this request, or null.
 *
 * `checkRevoked` makes Firebase confirm the session has not been revoked
 * (sign-out everywhere, disabled account, password change) rather than
 * trusting the cookie's signature alone.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch {
    // Expired, revoked, malformed, or the Admin SDK is unconfigured. All of
    // these mean "not signed in" as far as the caller is concerned.
    return null;
  }
});

/** Convenience for the common "I need the uid or nothing" case. */
export async function getUserId(): Promise<string | null> {
  return (await getSessionUser())?.uid ?? null;
}

/** Exchange a freshly minted ID token for a session cookie value. */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

/** Cookie options shared by the set and clear paths so they cannot diverge. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
