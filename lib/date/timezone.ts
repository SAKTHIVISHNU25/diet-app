/**
 * Timezone plumbing for "what day is it for *this* user".
 *
 * Server components have no idea where the browser is — `new Date()` there is
 * the host's clock, which in production is UTC. That made "today" flip hours
 * late (or early) for anyone not on UTC: food logged at 1am IST was stamped
 * with, and shown under, the previous day.
 *
 * The browser writes its IANA zone into a cookie (see
 * `components/shared/timezone-sync.tsx`) and every server-side "today" is
 * derived from that zone instead of the host clock.
 */

export const TIMEZONE_COOKIE_NAME = 'tz';
export const TIMEZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The zone the current runtime sits in — browser local, or the host's TZ. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Cookies are user input: reject anything `Intl` will not accept as a zone. */
export function isValidTimeZone(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Formatter construction is the expensive part, and there are only ever a
// handful of distinct zones in play per process.
const formatters = new Map<string, Intl.DateTimeFormat>();

/** YYYY-MM-DD for an instant *as seen in* `timeZone` — the calendar day there. */
export function toISODateInZone(timeZone: string, date: Date = new Date()): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Milliseconds until the next local midnight, used to re-render at day roll. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1000, midnight.getTime() - now.getTime());
}
