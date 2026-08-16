import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/firebase/session-constants';

/**
 * Routing-level auth guard.
 *
 * IMPORTANT: this middleware only checks whether a session cookie is *present*.
 * It does not verify it, because the Firebase Admin SDK cannot run on the Edge
 * runtime that middleware uses.
 *
 * That is safe, because this is a UX redirect and not the security boundary.
 * Real verification happens in three places that all run on the Node runtime:
 *
 *   1. app/(dashboard)/layout.tsx — verifies before rendering any user data
 *   2. every /api route handler   — verifies before reading or writing
 *   3. Realtime Database Rules    — the final backstop
 *
 * A forged cookie gets you a redirect to a page that immediately bounces you
 * back to /login, and no data.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/scan',
  '/diet-plan',
  '/history',
  '/journal',
  '/progress',
  '/profile',
  '/onboarding',
];

const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!hasSession && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
