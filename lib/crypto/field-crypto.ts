import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Application-level encryption primitive: AES-256-GCM.
 *
 * Firebase encrypts data at rest on its own disks, but that key belongs to
 * Google and the plaintext is visible to anyone who can read the database —
 * the Firebase Console, a leaked service-account key, an over-broad rule. This
 * layer means the database only ever holds ciphertext for user content: the
 * key lives in the app's environment, so a database dump on its own is inert.
 *
 * GCM is authenticated, so tampering is detected rather than silently decrypted
 * into garbage. Each record is bound to its own location via AAD (see
 * `record-crypto.ts`), which stops a ciphertext being copied from one user's
 * subtree into another's.
 *
 * Ciphertext format — dot-separated so it is a plain RTDB string:
 *
 *   v1.<keyId>.<iv base64url>.<ciphertext+tag base64url>
 *
 * The keyId identifies which key encrypted the record, which is what makes
 * rotation possible: new writes use the primary key, old records keep
 * decrypting with a retired one until they are rewritten.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class EncryptionError extends Error {}

export class DecryptionError extends Error {}

interface EncryptionKey {
  id: string;
  key: Buffer;
}

interface Keyring {
  primary: EncryptionKey;
  /** Primary + retired keys, by id. Used for decryption only. */
  byId: Map<string, EncryptionKey>;
}

let cachedKeyring: Keyring | null = null;

/**
 * Keys are read from the environment once and cached. Rotation is a deploy,
 * not a runtime event, so there is nothing to invalidate.
 *
 *   DATA_ENCRYPTION_KEY           primary — encrypts all new writes
 *   DATA_ENCRYPTION_KEYS_PREVIOUS comma-separated, decrypt-only
 */
function keyring(): Keyring {
  if (cachedKeyring) return cachedKeyring;

  const primary = parseKey(
    process.env.DATA_ENCRYPTION_KEY,
    'DATA_ENCRYPTION_KEY',
  );

  if (!primary) {
    throw new EncryptionError(
      'DATA_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local. Without it, user data cannot be read or written.',
    );
  }

  const byId = new Map<string, EncryptionKey>([[primary.id, primary]]);

  for (const [index, raw] of (process.env.DATA_ENCRYPTION_KEYS_PREVIOUS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .entries()) {
    const retired = parseKey(raw, `DATA_ENCRYPTION_KEYS_PREVIOUS[${index}]`);
    if (retired && !byId.has(retired.id)) byId.set(retired.id, retired);
  }

  cachedKeyring = { primary, byId };
  return cachedKeyring;
}

function parseKey(raw: string | undefined, label: string): EncryptionKey | null {
  const value = raw?.trim();
  if (!value) return null;

  // Accept base64 (the documented form) or 64 hex characters.
  const key = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');

  if (key.length !== KEY_BYTES) {
    throw new EncryptionError(
      `${label} must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`,
    );
  }

  return { id: fingerprint(key), key };
}

/**
 * A short, non-secret label for a key. Derived from the key itself so the same
 * key always yields the same id across machines and deploys, and so nothing
 * has to be tracked by hand when rotating.
 */
function fingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/** True when a usable primary key is configured. */
export function isEncryptionConfigured(): boolean {
  try {
    keyring();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt with the primary key.
 *
 * `aad` is authenticated but not encrypted: it must match exactly at decrypt
 * time, which is how a record is bound to its owner and path.
 */
export function encryptString(plaintext: string, aad: string): string {
  const { primary } = keyring();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, primary.key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const payload = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return [VERSION, primary.id, b64url(iv), b64url(payload)].join('.');
}

/** Decrypt a value produced by `encryptString`. Throws if `aad` differs. */
export function decryptString(value: string, aad: string): string {
  const parts = value.split('.');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DecryptionError('Value is not a recognised ciphertext.');
  }

  const [, keyId, ivPart, payloadPart] = parts as [string, string, string, string];
  const entry = keyring().byId.get(keyId);

  if (!entry) {
    throw new DecryptionError(
      `No key with id ${keyId} is configured. If the key was rotated, keep the old one in DATA_ENCRYPTION_KEYS_PREVIOUS until every record has been re-encrypted.`,
    );
  }

  const iv = fromB64url(ivPart);
  const payload = fromB64url(payloadPart);

  if (iv.length !== IV_BYTES || payload.length <= TAG_BYTES) {
    throw new DecryptionError('Ciphertext is malformed.');
  }

  const ciphertext = payload.subarray(0, payload.length - TAG_BYTES);
  const tag = payload.subarray(payload.length - TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, entry.key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    // GCM authentication failed: wrong key, altered ciphertext, or a record
    // moved to a different path than the one it was sealed for.
    throw new DecryptionError(
      'Could not authenticate ciphertext. The key, the data, or the record location has changed.',
    );
  }
}

/** Cheap shape test — distinguishes an encrypted blob from legacy plaintext. */
export function looksEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`);
}

function b64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}
