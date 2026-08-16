import { beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

// The keyring is read from the environment on first use and cached, so the
// keys must exist before the module is imported.
const PRIMARY = randomBytes(32).toString('base64');
process.env.DATA_ENCRYPTION_KEY = PRIMARY;

type RecordCrypto = typeof import('@/lib/crypto/record-crypto');
type FieldCrypto = typeof import('@/lib/crypto/field-crypto');

let recordCrypto: RecordCrypto;
let fieldCrypto: FieldCrypto;

beforeAll(async () => {
  recordCrypto = await import('@/lib/crypto/record-crypto');
  fieldCrypto = await import('@/lib/crypto/field-crypto');
});

const UID = 'user-abc';

describe('encryptRecord', () => {
  it('keeps queryable fields in plaintext and seals the rest', () => {
    const sealed = recordCrypto.encryptRecord('food_logs', UID, 'log1', {
      log_date: '2026-08-16',
      food_name: 'paneer tikka',
      grams: 180,
      calories: 420,
      created_at: 1_700_000_000_000,
    });

    // Queryable + structural fields survive: the range query depends on them.
    expect(sealed.log_date).toBe('2026-08-16');
    expect(sealed.created_at).toBe(1_700_000_000_000);

    // Everything else is gone from the node entirely.
    expect(sealed.food_name).toBeUndefined();
    expect(sealed.grams).toBeUndefined();
    expect(sealed.calories).toBeUndefined();

    expect(typeof sealed.enc).toBe('string');
    expect(sealed.enc as string).toMatch(/^v1\./);
    expect(JSON.stringify(sealed)).not.toContain('paneer');
  });

  it('round-trips through decryptRecord', () => {
    const original = {
      log_date: '2026-08-16',
      meal_type: 'lunch',
      food_name: 'dal tadka',
      grams: 200,
      calories: 310,
      confidence: 0.82,
      image_url: null,
    };

    const sealed = recordCrypto.encryptRecord('food_logs', UID, 'log1', original);
    const opened = recordCrypto.decryptRecord('food_logs', UID, 'log1', sealed);

    expect(opened).toEqual(original);
  });

  it('omits enc when every field is plaintext', () => {
    const sealed = recordCrypto.encryptRecord('weight_entries', UID, '2026-08-16', {
      entry_date: '2026-08-16',
    });

    expect(sealed).toEqual({ entry_date: '2026-08-16' });
  });

  it('drops undefined values rather than sealing them', () => {
    const sealed = recordCrypto.encryptRecord('weight_entries', UID, '2026-08-16', {
      entry_date: '2026-08-16',
      weight_kg: 71.4,
      note: undefined,
    });

    const opened = recordCrypto.decryptRecord(
      'weight_entries',
      UID,
      '2026-08-16',
      sealed,
    );

    expect(opened).toEqual({ entry_date: '2026-08-16', weight_kg: 71.4 });
    expect('note' in opened).toBe(false);
  });

  it('produces different ciphertext for identical input', () => {
    const input = { weight_kg: 71.4 };
    const a = recordCrypto.encryptRecord('weight_entries', UID, '2026-08-16', input);
    const b = recordCrypto.encryptRecord('weight_entries', UID, '2026-08-16', input);

    // A fresh IV per write, so equal weights are not equal ciphertext.
    expect(a.enc).not.toBe(b.enc);
  });
});

describe('location binding', () => {
  const sealed = () =>
    recordCrypto.encryptRecord('food_logs', UID, 'log1', {
      log_date: '2026-08-16',
      food_name: 'dal tadka',
    });

  it('refuses a record grafted into another user', () => {
    expect(() =>
      recordCrypto.decryptRecord('food_logs', 'attacker-uid', 'log1', sealed()),
    ).toThrow(fieldCrypto.DecryptionError);
  });

  it('refuses a record moved to another id', () => {
    expect(() =>
      recordCrypto.decryptRecord('food_logs', UID, 'log2', sealed()),
    ).toThrow(fieldCrypto.DecryptionError);
  });

  it('refuses a record moved to another collection', () => {
    expect(() =>
      recordCrypto.decryptRecord('diet_plans', UID, 'log1', sealed()),
    ).toThrow(fieldCrypto.DecryptionError);
  });

  /**
   * Flips one bit inside a payload segment. Done at the byte level, not by
   * editing a base64url character — the final character of a base64 string can
   * carry unused padding bits, so changing it does not reliably change the
   * decoded bytes.
   */
  function flipBit(blob: string, segment: number, byteIndex: number): string {
    const parts = blob.split('.');
    const bytes = Buffer.from(parts[segment] as string, 'base64url');
    bytes[byteIndex] = (bytes[byteIndex] ?? 0) ^ 0x01;
    parts[segment] = bytes.toString('base64url');
    return parts.join('.');
  }

  it('refuses tampered ciphertext', () => {
    const record = sealed();
    const blob = record.enc as string;

    expect(() =>
      recordCrypto.decryptRecord('food_logs', UID, 'log1', {
        ...record,
        enc: flipBit(blob, 3, 0),
      }),
    ).toThrow(fieldCrypto.DecryptionError);
  });

  it('refuses a tampered authentication tag', () => {
    const record = sealed();
    const blob = record.enc as string;
    const payload = Buffer.from(blob.split('.')[3] as string, 'base64url');

    expect(() =>
      recordCrypto.decryptRecord('food_logs', UID, 'log1', {
        ...record,
        // Last 16 bytes of the payload are the GCM tag.
        enc: flipBit(blob, 3, payload.length - 1),
      }),
    ).toThrow(fieldCrypto.DecryptionError);
  });

  it('refuses a tampered IV', () => {
    const record = sealed();

    expect(() =>
      recordCrypto.decryptRecord('food_logs', UID, 'log1', {
        ...record,
        enc: flipBit(record.enc as string, 2, 0),
      }),
    ).toThrow(fieldCrypto.DecryptionError);
  });
});

describe('decryptRecordSafe', () => {
  it('degrades to plaintext fields instead of throwing', () => {
    const sealed = recordCrypto.encryptRecord('food_logs', UID, 'log1', {
      log_date: '2026-08-16',
      food_name: 'dal tadka',
    });

    // Wrong uid — unreadable. One bad record must not fail a whole page.
    const opened = recordCrypto.decryptRecordSafe(
      'food_logs',
      'someone-else',
      'log1',
      sealed,
    );

    expect(opened.log_date).toBe('2026-08-16');
    expect(opened.food_name).toBeUndefined();
    expect(opened.enc).toBeUndefined();
  });
});

describe('legacy plaintext records', () => {
  it('passes through untouched so old and new data coexist', () => {
    const legacy = { log_date: '2026-08-16', food_name: 'idli', grams: 150 };

    expect(recordCrypto.decryptRecord('food_logs', UID, 'log1', legacy)).toEqual(
      legacy,
    );
  });

  it('is converted in place by a merge', () => {
    const legacy = { log_date: '2026-08-16', food_name: 'idli', grams: 150 };

    const merged = recordCrypto.mergeEncryptedRecord(
      'food_logs',
      UID,
      'log1',
      legacy,
      { grams: 200 },
    );

    expect(merged.food_name).toBeUndefined();
    expect(typeof merged.enc).toBe('string');
    expect(recordCrypto.decryptRecord('food_logs', UID, 'log1', merged)).toEqual({
      log_date: '2026-08-16',
      food_name: 'idli',
      grams: 200,
    });
  });
});

describe('mergeEncryptedRecord', () => {
  it('preserves fields the patch does not mention', () => {
    const sealed = recordCrypto.encryptRecord('diet_plan_meals', UID, 'meal1', {
      plan_id: 'plan1',
      name: 'Breakfast',
      day_index: 2,
      sort_order: 0,
      calories: 400,
    });

    const merged = recordCrypto.mergeEncryptedRecord(
      'diet_plan_meals',
      UID,
      'meal1',
      sealed,
      { calories: 450 },
    );

    expect(recordCrypto.decryptRecord('diet_plan_meals', UID, 'meal1', merged)).toEqual(
      {
        plan_id: 'plan1',
        name: 'Breakfast',
        day_index: 2,
        sort_order: 0,
        calories: 450,
      },
    );
  });

  it('never leaves a stale blob nested inside a new one', () => {
    const sealed = recordCrypto.encryptRecord('weight_entries', UID, '2026-08-16', {
      entry_date: '2026-08-16',
      weight_kg: 71.4,
    });

    const merged = recordCrypto.mergeEncryptedRecord(
      'weight_entries',
      UID,
      '2026-08-16',
      sealed,
      { weight_kg: 70.9 },
    );

    const opened = recordCrypto.decryptRecord(
      'weight_entries',
      UID,
      '2026-08-16',
      merged,
    );

    expect('enc' in opened).toBe(false);
    expect(opened.weight_kg).toBe(70.9);
  });
});

/** The key id embedded in a blob: v1.<keyId>.<iv>.<payload> */
function keyIdOf(blob: unknown): string {
  return String(blob).split('.')[1] ?? '';
}

describe('key rotation', () => {
  it('decrypts with a retired key and re-seals with the primary', async () => {
    // Sealed under what is about to become the retired key.
    const old = recordCrypto.encryptRecord('food_logs', UID, 'log1', {
      log_date: '2026-08-16',
      food_name: 'upma',
    });

    // The keyring is cached at module scope, so rotation means a fresh module.
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = PRIMARY;
    vi.resetModules();

    try {
      const rotated: RecordCrypto = await import('@/lib/crypto/record-crypto');

      // The old record still opens, because the retired key is still listed.
      expect(rotated.decryptRecord('food_logs', UID, 'log1', old).food_name).toBe(
        'upma',
      );

      // Rewriting it moves it onto the new key.
      const resealed = rotated.mergeEncryptedRecord('food_logs', UID, 'log1', old, {});
      expect(keyIdOf(resealed.enc)).not.toBe(keyIdOf(old.enc));
      expect(rotated.decryptRecord('food_logs', UID, 'log1', resealed).food_name).toBe(
        'upma',
      );
    } finally {
      process.env.DATA_ENCRYPTION_KEY = PRIMARY;
      delete process.env.DATA_ENCRYPTION_KEYS_PREVIOUS;
      vi.resetModules();
    }
  });

  it('fails loudly when the key that sealed a record is gone', async () => {
    const old = recordCrypto.encryptRecord('food_logs', UID, 'log1', {
      log_date: '2026-08-16',
      food_name: 'upma',
    });

    // Rotated WITHOUT keeping the previous key — the mistake this guards.
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    vi.resetModules();

    try {
      const rotated: RecordCrypto = await import('@/lib/crypto/record-crypto');
      expect(() => rotated.decryptRecord('food_logs', UID, 'log1', old)).toThrow(
        /No key with id/,
      );
    } finally {
      process.env.DATA_ENCRYPTION_KEY = PRIMARY;
      vi.resetModules();
    }
  });
});
