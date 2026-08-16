import 'server-only';

import { cookies } from 'next/headers';
import { addDays } from '@/lib/utils';
import {
  TIMEZONE_COOKIE_NAME,
  isValidTimeZone,
  localTimeZone,
  toISODateInZone,
} from '@/lib/date/timezone';

/**
 * Server-side "today", in the *user's* zone.
 *
 * Never call `toISODate()` in a server component for a user-facing day — it
 * resolves against the host clock (UTC in production). Use `getUserToday()`.
 */

/** The browser's zone from the cookie, falling back to the host's own zone. */
export async function getUserTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TIMEZONE_COOKIE_NAME)?.value;
  const value = raw ? decodeURIComponent(raw) : undefined;
  return isValidTimeZone(value) ? value : localTimeZone();
}

/** YYYY-MM-DD for the calendar day the user is currently living in. */
export async function getUserToday(): Promise<string> {
  return toISODateInZone(await getUserTimeZone());
}

/** `offsetDays` away from the user's today (negative for the past). */
export async function getUserDate(offsetDays: number): Promise<string> {
  return toISODateInZone(await getUserTimeZone(), addDays(new Date(), offsetDays));
}
