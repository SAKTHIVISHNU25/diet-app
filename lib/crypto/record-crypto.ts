import 'server-only';

import {
  DecryptionError,
  decryptString,
  encryptString,
  looksEncrypted,
} from './field-crypto';

/**
 * Record-level encryption for user data in Realtime Database.
 *
 * Every field a user actually typed or generated is folded into ONE encrypted
 * blob per record, stored under the `enc` key. A whole-record blob is used
 * rather than per-field ciphertext for two reasons: it hides which optional
 * fields are even present (an empty `note` vs. a long one is not visible), and
 * it costs one GCM operation per record instead of a dozen.
 *
 * What stays in plaintext is only what the database itself has to understand:
 *
 *   food_logs        log_date   — orderByChild + equalTo/startAt range queries
 *   diet_plan_meals  plan_id    — orderByChild + equalTo
 *   diet_plans       is_active  — .indexOn, selects the current plan
 *   weight_entries   entry_date — it IS the node key, so already exposed
 *   all              created_at / updated_at — ServerValue.TIMESTAMP sentinels
 *
 * These are dates and opaque push ids. They leak that a user logged food on a
 * given day, not what they ate, how much, or what they weigh.
 *
 * `profiles` is deliberately absent: it is stored in the clear so that
 * Database Rules can keep validating age, weight and enum fields server-side,
 * which they cannot do through ciphertext.
 */

export type EncryptedCollection =
  | 'food_logs'
  | 'diet_plans'
  | 'diet_plan_meals'
  | 'weight_entries';

/** The key holding the sealed remainder of each record. */
export const ENCRYPTED_FIELD = 'enc';

const ALWAYS_PLAINTEXT = ['created_at', 'updated_at'] as const;

const PLAINTEXT_FIELDS: Record<EncryptedCollection, readonly string[]> = {
  food_logs: ['log_date', ...ALWAYS_PLAINTEXT],
  diet_plans: ['is_active', ...ALWAYS_PLAINTEXT],
  diet_plan_meals: ['plan_id', ...ALWAYS_PLAINTEXT],
  weight_entries: ['entry_date', ...ALWAYS_PLAINTEXT],
};

/**
 * Binds a ciphertext to its exact location. Decryption fails if a record is
 * copied into another user's subtree, another collection, or another id — so
 * an attacker with write access cannot graft someone else's data onto their
 * own account and have the app read it back.
 */
function aadFor(
  collection: EncryptedCollection,
  uid: string,
  recordId: string,
): string {
  return `${collection}:${uid}:${recordId}`;
}

/**
 * Split a record into its queryable fields plus one encrypted blob.
 *
 * `undefined` values are dropped the same way `stripUndefined` drops them, so
 * an omitted optional field stays omitted rather than being sealed as null.
 * Timestamp sentinels pass through untouched — they must reach the server as
 * objects for `ServerValue.TIMESTAMP` to resolve.
 */
export function encryptRecord(
  collection: EncryptedCollection,
  uid: string,
  recordId: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const plaintextKeys = PLAINTEXT_FIELDS[collection];
  const out: Record<string, unknown> = {};
  const sensitive: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (key === ENCRYPTED_FIELD) continue; // never re-seal an existing blob
    if (plaintextKeys.includes(key)) out[key] = value;
    else sensitive[key] = value;
  }

  if (Object.keys(sensitive).length > 0) {
    out[ENCRYPTED_FIELD] = encryptString(
      JSON.stringify(sensitive),
      aadFor(collection, uid, recordId),
    );
  }

  return out;
}

/**
 * Inverse of `encryptRecord`: the stored node, with `enc` unsealed and merged
 * back into a flat object the existing `normalize*` functions can read.
 *
 * Records written before encryption was introduced have no `enc` key and are
 * returned as-is, so old and new data can coexist and the migration script can
 * run at any time rather than as a hard cutover.
 */
export function decryptRecord(
  collection: EncryptedCollection,
  uid: string,
  recordId: string,
  stored: unknown,
): Record<string, unknown> {
  if (!stored || typeof stored !== 'object') return {};

  const row = { ...(stored as Record<string, unknown>) };
  const blob = row[ENCRYPTED_FIELD];
  delete row[ENCRYPTED_FIELD];

  if (!looksEncrypted(blob)) return row;

  const json = decryptString(blob, aadFor(collection, uid, recordId));
  const parsed: unknown = JSON.parse(json);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DecryptionError('Decrypted payload was not an object.');
  }

  // Plaintext keys win: they are what the database indexed and queried on.
  return { ...(parsed as Record<string, unknown>), ...row };
}

/**
 * Decrypt for a read path that must not fail the whole page.
 *
 * One unreadable record — a key rotated without keeping the old one, a node
 * edited by hand in the console — should not blank out a user's entire
 * history. The failure is logged and the record degrades to its plaintext
 * fields, which the `normalize*` functions then fill with safe defaults.
 */
export function decryptRecordSafe(
  collection: EncryptedCollection,
  uid: string,
  recordId: string,
  stored: unknown,
): Record<string, unknown> {
  try {
    return decryptRecord(collection, uid, recordId, stored);
  } catch (error) {
    console.error(`[crypto:decrypt] ${collection}/${recordId}`, error);
    const row = { ...((stored ?? {}) as Record<string, unknown>) };
    delete row[ENCRYPTED_FIELD];
    return row;
  }
}

/**
 * Apply a partial update to an encrypted record.
 *
 * A single blob cannot be patched in place, so a partial write is
 * read-modify-write: unseal what is stored, merge the patch over it, reseal
 * the whole thing. Every caller already reads the node first to check it
 * exists, so this adds no extra round trip.
 *
 * The result is a complete record intended for `ref.set()`, NOT `ref.update()`
 * — a merge-update would leave a stale `enc` alongside the new one.
 */
export function mergeEncryptedRecord(
  collection: EncryptedCollection,
  uid: string,
  recordId: string,
  stored: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const current = decryptRecord(collection, uid, recordId, stored);
  return encryptRecord(collection, uid, recordId, { ...current, ...patch });
}
