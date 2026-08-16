import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, handleUnexpected } from '@/lib/utils/api';
import { adminAuth, isAdminConfigured } from '@/lib/firebase/admin';
import {
  createSessionCookie,
  sessionCookieOptions,
  SESSION_MAX_AGE_MS,
} from '@/lib/firebase/server';

/**
 * Session bridge between the Firebase client SDK and the server.
 *
 * POST   — exchange an ID token for an httpOnly session cookie (sign in)
 * DELETE — clear the cookie (sign out)
 */

const bodySchema = z.object({
  idToken: z.string().min(20, 'Missing ID token').max(4096),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('invalid_request', 'Could not start your session.');
    }

    // Checked before verifying, so a missing service account is reported as a
    // configuration problem rather than mistaken for an invalid token.
    if (!isAdminConfigured()) {
      console.error(
        '[api:auth/session] FIREBASE_SERVICE_ACCOUNT_KEY is not set — cannot mint a session cookie.',
      );
      return apiError(
        'not_configured',
        'The server is not configured to start sessions. See the server logs.',
      );
    }

    // Verify before minting. `checkRevoked` rejects a token from an account
    // that has since been disabled or signed out everywhere.
    let uid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(parsed.data.idToken, true);
      uid = decoded.uid;
    } catch (error) {
      console.warn('[api:auth/session] ID token verification failed', error);
      return apiError('unauthenticated', 'That sign-in could not be verified.');
    }

    const sessionCookie = await createSessionCookie(parsed.data.idToken);

    const response = apiSuccess({ uid });
    response.cookies.set({
      ...sessionCookieOptions(SESSION_MAX_AGE_MS / 1000),
      value: sessionCookie,
    });

    return response;
  } catch (error) {
    return handleUnexpected('auth/session:post', error);
  }
}

export async function DELETE() {
  try {
    const response = apiSuccess({ signedOut: true });
    // maxAge 0 expires the cookie immediately.
    response.cookies.set({ ...sessionCookieOptions(0), value: '' });
    return response;
  } catch (error) {
    return handleUnexpected('auth/session:delete', error);
  }
}
