import 'server-only';

import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

/**
 * Firebase Admin SDK — server only.
 *
 * This bypasses Database and Storage Rules, which is why it must never reach
 * the browser. Every caller is responsible for scoping reads and writes to the
 * verified session's uid. The Rules stay in place as a second layer, covering
 * the direct client access used for photo uploads.
 *
 * Credentials come from FIREBASE_SERVICE_ACCOUNT_KEY: the service-account JSON,
 * either raw or base64-encoded (base64 is easier to paste into Vercel, since
 * the raw JSON contains newlines).
 */

const ADMIN_APP_NAME = 'mylyf-admin';

class FirebaseAdminError extends Error {}

function loadServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new FirebaseAdminError(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Download a service account key from Firebase Console → Project settings → Service accounts.',
    );
  }

  let json = raw.trim();

  // Accept base64 as well as raw JSON.
  if (!json.startsWith('{')) {
    try {
      json = Buffer.from(json, 'base64').toString('utf8');
    } catch {
      throw new FirebaseAdminError(
        'FIREBASE_SERVICE_ACCOUNT_KEY could not be decoded. Provide the service account JSON, or its base64 encoding.',
      );
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new FirebaseAdminError('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }

  const projectId = String(parsed.project_id ?? '');
  const clientEmail = String(parsed.client_email ?? '');
  // Env vars flatten newlines to the literal characters "\n"; restore them.
  const privateKey = String(parsed.private_key ?? '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminError(
      'FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or private_key.',
    );
  }

  return { projectId, clientEmail, privateKey };
}

function databaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!url) {
    throw new FirebaseAdminError(
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set. Create a Realtime Database in the Firebase Console and copy its URL.',
    );
  }
  return url;
}

function getAdminApp(): App {
  const existing = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
  if (existing) return getApp(ADMIN_APP_NAME);

  const serviceAccount = loadServiceAccount();

  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
      databaseURL: databaseUrl(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    ADMIN_APP_NAME,
  );
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Realtime Database handle. */
export function adminDb(): Database {
  return getDatabase(getAdminApp());
}

export function adminStorage() {
  return getStorage(getAdminApp());
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

/**
 * Database paths.
 *
 * Everything a user owns is nested under their uid. That is the key design
 * decision for Realtime Database: it makes the security rules a one-line
 * `$uid === auth.uid` check, and means a query physically cannot reach another
 * user's data — there is no cross-user index to filter.
 */
export const PATHS = {
  profile: (uid: string) => `profiles/${uid}`,
  foodLogs: (uid: string) => `food_logs/${uid}`,
  foodLog: (uid: string, id: string) => `food_logs/${uid}/${id}`,
  dietPlans: (uid: string) => `diet_plans/${uid}`,
  dietPlan: (uid: string, id: string) => `diet_plans/${uid}/${id}`,
  dietPlanMeals: (uid: string) => `diet_plan_meals/${uid}`,
  dietPlanMeal: (uid: string, id: string) => `diet_plan_meals/${uid}/${id}`,
  weightEntries: (uid: string) => `weight_entries/${uid}`,
  weightEntry: (uid: string, date: string) => `weight_entries/${uid}/${date}`,
  journalEntries: (uid: string) => `journal_entries/${uid}`,
  journalEntry: (uid: string, date: string) => `journal_entries/${uid}/${date}`,
  foodCache: 'food_cache',
  foodCacheEntry: (queryKey: string) => `food_cache/${encodeKey(queryKey)}`,
} as const;

/**
 * Realtime Database keys cannot contain . $ # [ ] / or control characters.
 * Cache keys are already lowercased and punctuation-stripped, but this is the
 * guarantee rather than an assumption.
 */
export function encodeKey(key: string): string {
  return key.replace(/[.$#[\]/ -]/g, '_');
}
