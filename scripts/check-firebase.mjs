/**
 * Firebase preflight check.
 *
 * Run with:  npm run check:firebase
 *
 * Verifies the whole chain before you touch the UI, because every failure mode
 * below looks like the same vague "could not create your account" in the
 * browser:
 *
 *   1. every NEXT_PUBLIC_FIREBASE_* value is present
 *   2. the service account parses AND belongs to the SAME project as the web
 *      config (a mismatch fails only at verifyIdToken, after the account is
 *      already created)
 *   3. Authentication is enabled — probes the Identity Toolkit for
 *      CONFIGURATION_NOT_FOUND
 *   4. Email/Password sign-in is switched on
 *   5. the Realtime Database exists at the configured URL, in the right region
 *   6. the Admin SDK can actually read and write
 *
 * Exits non-zero if anything is wrong.
 */

import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Fall back to the ambient environment.
  }
}

loadEnv();

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let failures = 0;
let warnings = 0;

function pass(message, detail) {
  console.log(`  ${GREEN}✓${RESET} ${message}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}

function fail(message, fix) {
  failures += 1;
  console.log(`  ${RED}✗${RESET} ${message}`);
  if (fix) console.log(`    ${DIM}→ ${fix}${RESET}`);
}

function warn(message, detail) {
  warnings += 1;
  console.log(`  ${YELLOW}!${RESET} ${message}`);
  if (detail) console.log(`    ${DIM}→ ${detail}${RESET}`);
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------- 1. web config

section('Web config');

const REQUIRED_PUBLIC = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
];

for (const key of REQUIRED_PUBLIC) {
  const value = process.env[key];
  if (!value || value.includes('your-project') || value.startsWith('AIzaSy...')) {
    fail(`${key} is missing or still a placeholder`, 'Firebase Console → Project settings → General → Your apps');
  } else {
    pass(key, key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' ? `= ${value}` : '');
  }
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

// ----------------------------------------------------------- 2. service account

section('Service account');

let serviceAccount = null;
const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!rawKey) {
  fail(
    'FIREBASE_SERVICE_ACCOUNT_KEY is not set',
    'Console → Project settings → Service accounts → Generate new private key',
  );
} else {
  let json = rawKey.trim();
  if (!json.startsWith('{')) {
    try {
      json = Buffer.from(json, 'base64').toString('utf8');
    } catch {
      fail('FIREBASE_SERVICE_ACCOUNT_KEY is neither JSON nor valid base64');
    }
  }

  try {
    const parsed = JSON.parse(json);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      fail('Service account JSON is missing project_id, client_email or private_key');
    } else if (parsed.project_id !== projectId) {
      // This is the failure that costs the most time to diagnose by hand: the
      // app signs in fine, then every request 401s on an audience mismatch.
      fail(
        `Service account belongs to "${parsed.project_id}" but the web config is for "${projectId}"`,
        `Generate the key from the ${projectId} project instead — sign-in will fail with an "incorrect aud claim" error otherwise`,
      );
    } else {
      serviceAccount = {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
      pass('Service account parses and matches the project', `(${parsed.client_email})`);
    }
  } catch {
    fail('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }
}

// --------------------------------------------------------------- 3. auth enabled

section('Authentication');

if (!apiKey || failures > 0 && !projectId) {
  warn('Skipped — fix the web config first');
} else {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A deliberately invalid password: we only care which error comes back,
        // and this can never create a real account.
        body: JSON.stringify({ email: 'preflight@example.invalid', password: 'x' }),
      },
    );

    const body = await response.json();
    const message = body?.error?.message ?? '';

    if (message === 'CONFIGURATION_NOT_FOUND') {
      fail(
        'Firebase Authentication is not set up for this project',
        'Console → Authentication → Get started → Sign-in method → Email/Password → Enable',
      );
    } else if (message === 'OPERATION_NOT_ALLOWED') {
      fail(
        'Email/Password sign-in is disabled',
        'Console → Authentication → Sign-in method → Email/Password → Enable',
      );
    } else if (message.startsWith('API key not valid')) {
      fail('NEXT_PUBLIC_FIREBASE_API_KEY is not valid');
    } else if (message === 'WEAK_PASSWORD' || message.includes('WEAK_PASSWORD')) {
      // The provider accepted the request and only rejected the password —
      // which is exactly what a correctly configured project does.
      pass('Authentication is enabled with Email/Password');
    } else if (message === 'ADMIN_ONLY_OPERATION') {
      fail('Sign-ups are disabled', 'Console → Authentication → Settings');
    } else {
      warn(`Unexpected Identity Toolkit response: ${message || response.status}`);
    }
  } catch (error) {
    fail(`Could not reach the Identity Toolkit: ${error.message}`);
  }
}

// ----------------------------------------------------------- 4. realtime database

section('Realtime Database');

let databaseExists = false;

if (!databaseURL) {
  warn('Skipped — NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set');
} else {
  try {
    // An unauthenticated read of a locked database returns 401, which proves
    // the database exists at this URL. 404 means it does not.
    const response = await fetch(`${databaseURL.replace(/\/$/, '')}/.json?shallow=true`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404) {
      fail(
        `No database at ${databaseURL}`,
        'Either it has not been created (Console → Build → Realtime Database), or the region in the URL is wrong',
      );
    } else if (response.status === 401 || response.status === 403) {
      databaseExists = true;
      pass('Database exists and rules are locked down', '(unauthenticated read denied)');
    } else if (response.ok) {
      databaseExists = true;
      warn(
        'Database is readable WITHOUT authentication',
        'Test-mode rules are still active — run: npx firebase deploy --only database',
      );
    } else {
      warn(`Unexpected response from the database: ${response.status}`);
    }
  } catch (error) {
    fail(`Could not reach ${databaseURL}: ${error.message}`);
  }
}

// -------------------------------------------------------------- 5. admin read/write

section('Admin SDK');

if (!serviceAccount) {
  warn('Skipped — needs a service account matching the project');
} else if (!databaseExists) {
  // The Admin SDK retries a missing database indefinitely, so attempting the
  // round trip here would simply hang. Nothing useful to learn until the
  // database exists.
  warn('Skipped — create the Realtime Database first');
} else {
  let adminApp = null;

  try {
    const { cert, initializeApp, deleteApp } = await import('firebase-admin/app');
    const { getDatabase } = await import('firebase-admin/database');

    adminApp = initializeApp({ credential: cert(serviceAccount), databaseURL }, 'preflight');

    const db = getDatabase(adminApp);
    const ref = db.ref('_preflight');

    // Bounded, because a wrong region or a revoked key otherwise stalls here
    // rather than failing.
    const roundTrip = (async () => {
      await ref.set({ checked_at: Date.now() });
      const snapshot = await ref.get();
      await ref.remove();
      return snapshot.exists();
    })();

    const ok = await Promise.race([
      roundTrip,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timed out after 15s')), 15_000),
      ),
    ]);

    if (ok) pass('Admin SDK can read and write');
    else fail('Admin SDK wrote but could not read back');

    db.goOffline();
    await deleteApp(adminApp);
  } catch (error) {
    fail(
      `Admin SDK failed: ${error.message}`,
      'Check the service account is current (not a deleted key) and the database URL region is right',
    );
    // The SDK holds an open socket that would keep the process alive.
    try {
      const { deleteApp } = await import('firebase-admin/app');
      if (adminApp) await deleteApp(adminApp);
    } catch {
      // Nothing more to do; the explicit exit below handles it.
    }
  }
}

// -------------------------------------------------------------------- 6. optional

section('Optional services');

if (process.env.USDA_API_KEY) pass('USDA_API_KEY is set');
else warn('USDA_API_KEY is not set', 'Nutrition search falls back to the local cache');

const visionProvider = process.env.FOOD_VISION_PROVIDER || 'huggingface';
if (visionProvider === 'mock') {
  pass('Food vision provider = mock', '(no token needed)');
} else if (process.env.HF_TOKEN) {
  pass(`Food vision provider = ${visionProvider}`, '(HF_TOKEN set)');
} else {
  warn(
    `FOOD_VISION_PROVIDER=${visionProvider} but HF_TOKEN is not set`,
    'Set HF_TOKEN, or use FOOD_VISION_PROVIDER=mock while testing',
  );
}

// ------------------------------------------------------------------------ summary

console.log('');
if (failures > 0) {
  console.log(`${RED}${failures} problem${failures > 1 ? 's' : ''} to fix${RESET}${warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}.`);
  process.exit(1);
}

console.log(
  warnings > 0
    ? `${GREEN}Firebase is configured${RESET} (${warnings} warning${warnings > 1 ? 's' : ''}).`
    : `${GREEN}Everything checks out.${RESET}`,
);
process.exit(0);
