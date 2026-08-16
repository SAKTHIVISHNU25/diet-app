'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirebaseAuth } from './client';

/**
 * Client-side auth, plus the server-session handshake.
 *
 * Firebase Auth runs in the browser, but this app renders pages on the server,
 * so every sign-in is followed by exchanging the ID token for an httpOnly
 * session cookie. Until that exchange succeeds the user is not signed in as far
 * as the server is concerned, so the two are always done together here.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: 'email' | 'password',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Exchange the current ID token for a server session cookie. */
async function establishSession(idToken: string): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
    throw new AuthError(
      'Could not reach the server to start your session. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    // Leave no half-signed-in state: the client thinks it is authenticated but
    // the server does not, which would loop the user through /login forever.
    await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);

    // The most common cause by far is a missing or malformed
    // FIREBASE_SERVICE_ACCOUNT_KEY, which fails on the server with no clue
    // visible in the browser. Say so rather than "please try again".
    throw new AuthError(
      response.status >= 500
        ? 'Your account exists, but the server could not start a session. This usually means FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid — check the server logs.'
        : 'Your sign-in could not be verified by the server. Please try again.',
    );
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const auth = getFirebaseAuth();

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await establishSession(await credential.user.getIdToken());
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(describeFirebaseAuthError(error, 'signin'));
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const auth = getFirebaseAuth();

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await establishSession(await credential.user.getIdToken());
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(describeFirebaseAuthError(error, 'signup'));
  }
}

export async function signOut(): Promise<void> {
  // Clear the server cookie first — if the page reloads midway, better to be
  // signed out everywhere than signed in on the server only.
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
  await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
}

/**
 * Map a Firebase error code to something worth reading.
 *
 * Sign-in failures are deliberately collapsed into one generic message:
 * distinguishing "no such user" from "wrong password" would let anyone
 * enumerate which addresses have accounts.
 */
function describeFirebaseAuthError(error: unknown, mode: 'signin' | 'signup'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/email-already-in-use':
      return 'An account already exists for that email address.';

    case 'auth/weak-password':
      return 'Please choose a stronger password of at least 8 characters.';

    case 'auth/operation-not-allowed':
      return 'Email sign-in is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method → Email/Password.';

    // Returned when Authentication has never been set up for the project at
    // all — the Identity Toolkit reports CONFIGURATION_NOT_FOUND.
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not set up for this project. Open Firebase Console → Authentication → Get started, then enable Email/Password.';

    case 'auth/admin-restricted-operation':
      return 'Sign-ups are disabled for this project. Enable them in Firebase Console → Authentication → Settings.';

    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';

    case 'auth/user-disabled':
      return 'That account has been disabled.';

    case 'auth/network-request-failed':
      return 'Could not reach the authentication server. Check your connection and that the NEXT_PUBLIC_FIREBASE_* values are set correctly.';

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'The Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local.';

    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email or password is not correct.';

    default: {
      // An unrecognised code must never become an unactionable dead end. The
      // code is logged and shown — Firebase auth codes describe configuration,
      // not user data, so there is nothing sensitive in them.
      console.error('[auth] Unhandled Firebase error', { code, error });

      const base =
        mode === 'signup'
          ? 'Could not create your account.'
          : 'Could not sign you in.';

      return code ? `${base} (${code})` : `${base} Please try again.`;
    }
  }
}
