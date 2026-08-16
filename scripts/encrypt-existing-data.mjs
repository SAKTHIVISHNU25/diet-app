/**
 * Encrypts user data already stored in Realtime Database in plaintext.
 *
 * Run with:  node scripts/encrypt-existing-data.mjs [--dry-run]
 *
 * The app reads both shapes — a record without an `enc` field is treated as
 * legacy plaintext and returned as-is — so this can be run at any point after
 * deploying, and re-run safely. Records that are already encrypted are skipped,
 * which also makes the script resumable if it is interrupted.
 *
 * `profiles` is intentionally never touched: it stays in the clear so Database
 * Rules can keep validating age, weight and the enum fields.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_DATABASE_URL and
 * DATA_ENCRYPTION_KEY in .env.local.
 *
 * TAKE A BACKUP FIRST — Firebase Console → Realtime Database → ⋮ → Export JSON.
 * Without the key, encrypted data cannot be recovered.
 */

import { readFileSync } from 'node:fs';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Minimal .env.local loader so this script needs no extra dependency.
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

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Mirrors PLAINTEXT_FIELDS in lib/crypto/record-crypto.ts. Kept as a literal
 * rather than imported because this script runs as plain ESM outside the Next
 * build, where the TypeScript path aliases and `server-only` do not resolve.
 * If the field policy changes there, change it here too.
 */
const COLLECTIONS = {
  food_logs: ['log_date', 'created_at', 'updated_at'],
  diet_plans: ['is_active', 'created_at', 'updated_at'],
  diet_plan_meals: ['plan_id', 'created_at', 'updated_at'],
  weight_entries: ['entry_date', 'created_at', 'updated_at'],
};

function loadKey() {
  const raw = (process.env.DATA_ENCRYPTION_KEY ?? '').trim();
  if (!raw) {
    console.error(
      'DATA_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.',
    );
    process.exit(1);
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    console.error(`DATA_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`);
    process.exit(1);
  }
  return { key, id: createHash('sha256').update(key).digest('hex').slice(0, 8) };
}

const { key: KEY, id: KEY_ID } = loadKey();

function encryptString(plaintext, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const payload = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  return ['v1', KEY_ID, iv.toString('base64url'), payload.toString('base64url')].join(
    '.',
  );
}

function encryptRecord(collection, uid, recordId, record) {
  const plaintextKeys = COLLECTIONS[collection];
  const out = {};
  const sensitive = {};

  for (const [field, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (field === 'enc') continue;
    if (plaintextKeys.includes(field)) out[field] = value;
    else sensitive[field] = value;
  }

  if (Object.keys(sensitive).length > 0) {
    out.enc = encryptString(
      JSON.stringify(sensitive),
      `${collection}:${uid}:${recordId}`,
    );
  }

  return out;
}

function initAdmin() {
  let json = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? '').trim();
  if (!json) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
    process.exit(1);
  }
  if (!json.startsWith('{')) json = Buffer.from(json, 'base64').toString('utf8');

  const parsed = JSON.parse(json);
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    console.error('NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set.');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key ?? '').replace(/\\n/g, '\n'),
    }),
    databaseURL,
  });

  return getDatabase();
}

async function migrateCollection(db, collection) {
  const snapshot = await db.ref(collection).get();
  const byUser = snapshot.val();

  if (!byUser || typeof byUser !== 'object') {
    console.log(`  ${collection}: nothing stored`);
    return { encrypted: 0, skipped: 0 };
  }

  let encrypted = 0;
  let skipped = 0;

  for (const [uid, records] of Object.entries(byUser)) {
    if (!records || typeof records !== 'object') continue;

    // One multi-path update per user: every record for that user flips
    // together, so a failure cannot leave a half-converted account.
    const updates = {};

    for (const [recordId, record] of Object.entries(records)) {
      if (!record || typeof record !== 'object') continue;
      if (typeof record.enc === 'string' && record.enc.startsWith('v1.')) {
        skipped += 1;
        continue;
      }
      updates[recordId] = encryptRecord(collection, uid, recordId, record);
      encrypted += 1;
    }

    if (Object.keys(updates).length === 0) continue;

    if (!DRY_RUN) {
      // `set` per record, not a merge — the plaintext fields must disappear
      // rather than linger beside the new `enc` blob.
      await Promise.all(
        Object.entries(updates).map(([recordId, value]) =>
          db.ref(`${collection}/${uid}/${recordId}`).set(value),
        ),
      );
    }
  }

  console.log(
    `  ${collection}: ${encrypted} encrypted, ${skipped} already encrypted`,
  );
  return { encrypted, skipped };
}

async function main() {
  const db = initAdmin();

  console.log(
    DRY_RUN
      ? 'Dry run — reporting what would change, writing nothing.\n'
      : `Encrypting with key ${KEY_ID}. Take a backup first if you have not.\n`,
  );

  let total = 0;
  for (const collection of Object.keys(COLLECTIONS)) {
    const { encrypted } = await migrateCollection(db, collection);
    total += encrypted;
  }

  console.log(
    DRY_RUN
      ? `\n${total} record(s) would be encrypted.`
      : `\nDone. ${total} record(s) encrypted.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
