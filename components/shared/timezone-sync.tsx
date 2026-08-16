'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TIMEZONE_COOKIE_MAX_AGE,
  TIMEZONE_COOKIE_NAME,
  localTimeZone,
  msUntilNextLocalMidnight,
} from '@/lib/date/timezone';
import { toISODate } from '@/lib/utils';

/**
 * Keeps every server-rendered page on the user's calendar day.
 *
 * Two jobs, both invisible:
 *
 *  1. Publish the browser's IANA zone in a cookie so server components can
 *     resolve "today" for this user instead of for the UTC host. When the
 *     server rendered with a different zone than the browser actually has —
 *     the first load after signing in, or after travelling — refresh so the
 *     page is rebuilt against the right day.
 *  2. Refresh again at local midnight. A dashboard left open (or a PWA resumed
 *     from the background) otherwise keeps showing yesterday's log as "Today"
 *     until something else triggers a navigation.
 */
export function TimezoneSync({ serverTimeZone }: { serverTimeZone: string }) {
  const router = useRouter();

  useEffect(() => {
    const timeZone = localTimeZone();

    document.cookie = [
      `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(timeZone)}`,
      'path=/',
      `max-age=${TIMEZONE_COOKIE_MAX_AGE}`,
      'samesite=lax',
    ].join('; ');

    if (timeZone !== serverTimeZone) router.refresh();
  }, [router, serverTimeZone]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let renderedDate = toISODate();

    // Refresh only on an actual day change, so returning to the tab mid-day
    // costs nothing.
    const refreshIfDayChanged = () => {
      const current = toISODate();
      if (current === renderedDate) return;
      renderedDate = current;
      router.refresh();
    };

    // Re-armed after each rollover rather than set on an interval, so DST
    // shifts and long sleeps cannot drift the wake-up away from midnight.
    const schedule = () => {
      timer = setTimeout(() => {
        refreshIfDayChanged();
        schedule();
      }, msUntilNextLocalMidnight());
    };

    schedule();

    // A backgrounded tab's timers are throttled and can fire late — a PWA
    // resumed the next morning must not wait for a stale timeout.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      refreshIfDayChanged();
      schedule();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
