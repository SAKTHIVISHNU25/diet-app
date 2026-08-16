import 'server-only';

/**
 * Realtime Database <-> app conversions.
 *
 * RTDB stores plain JSON: no types beyond string/number/boolean/object/null.
 * Timestamps written with ServerValue.TIMESTAMP arrive as epoch milliseconds,
 * so they need converting to the ISO strings the app's types declare.
 */

/** Epoch millis | ISO string | Date -> ISO string. */
export function toISOString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(0).toISOString();
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * RTDB returns a keyed object for a collection, not an array — and omits empty
 * ones entirely (null rather than {}). This turns either into entries.
 */
export function toEntries(
  value: unknown,
): { id: string; data: Record<string, unknown> }[] {
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(
      (entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === 'object' && entry[1] !== null,
    )
    .map(([id, data]) => ({ id, data }));
}

/**
 * RTDB silently drops keys whose value is `undefined`, but the Admin SDK throws
 * instead. Stripping them keeps optional fields behaving like an omitted column
 * rather than an error.
 */
export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
