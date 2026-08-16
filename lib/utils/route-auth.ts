import 'server-only';

import type { NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/firebase/server';
import { unauthenticated, type ApiErrorBody } from './api';

/**
 * Verify the session at the start of a route handler.
 *
 *   const auth = await requireUser();
 *   if ('response' in auth) return auth.response;
 *   // auth.user.uid is now trustworthy
 *
 * This is a genuine verification against Firebase (signature plus revocation),
 * not a cookie-presence check — the middleware does the cheap check, this does
 * the real one.
 */
export async function requireUser(): Promise<
  { user: SessionUser } | { response: NextResponse<ApiErrorBody> }
> {
  const user = await getSessionUser();
  if (!user) return { response: unauthenticated() };
  return { user };
}
