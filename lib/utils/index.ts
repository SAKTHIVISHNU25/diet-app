import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className merge used by every UI component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Local (not UTC) YYYY-MM-DD for a date — the format used by all date columns. */
export function toISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local date (avoids the UTC shift of `new Date(str)`). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDateLong(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "Today" / "Yesterday" / a short date.
 *
 * `today` defaults to this runtime's local day, which is only correct in the
 * browser. Server components must pass `getUserToday()` — the host clock is
 * UTC in production and would label the wrong day.
 */
export function formatRelativeDate(iso: string, today: string = toISODate()): string {
  if (iso === today) return 'Today';
  if (iso === toISODate(addDays(fromISODate(today), -1))) return 'Yesterday';
  return formatDateLong(iso);
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Title-cases a food label: "grilled_salmon" -> "Grilled Salmon". */
export function humanizeFoodLabel(label: string): string {
  return label
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Stable key for the food cache: lowercased, punctuation-free, single-spaced. */
export function normalizeFoodQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Values from the database can arrive as numeric strings; coerce defensively. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Deterministic PRNG so a given seed always produces the same diet plan. */
export function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
