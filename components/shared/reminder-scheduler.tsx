'use client';

import { useEffect, useRef, useState } from 'react';
import {
  dueReminders,
  loadLastFired,
  loadPrefs,
  markFired,
  msUntilNextReminder,
  PREFS_KEY,
} from '@/lib/notifications/reminders';
import { showReminderNotification } from '@/lib/notifications/notify';

// Timers this long are unreliable in a backgrounded tab, so the scheduler wakes
// up at least this often and recomputes instead of trusting one long sleep.
const MAX_SLEEP_MS = 15 * 60 * 1000;

/**
 * Fires the user's local reminders while the app is open.
 *
 * Deliberately not push. There is no server sending anything: this arms a
 * timer, and on each wake it asks "which reminders came due and have not fired
 * today?" — so a throttled tab, a sleeping phone or a mid-day visit all
 * converge on the same answer instead of double-firing or missing silently.
 *
 * Renders nothing; mounted once in the dashboard layout.
 */
export function ReminderScheduler() {
  // Preference edits happen in another part of the tree; this counter is how
  // the settings UI asks the scheduler to re-read and re-arm.
  const [revision, setRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREFS_KEY) bump();
    };

    window.addEventListener('mylyf:notifications-changed', bump);
    // Another tab changing the settings should re-arm this one too.
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('mylyf:notifications-changed', bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      const prefs = loadPrefs();
      const now = new Date();

      for (const meta of dueReminders(prefs, now, loadLastFired())) {
        // Marked before awaiting: a second tick must not race in and re-fire.
        markFired(meta.id, now);
        await showReminderNotification(meta);
      }

      if (cancelled) return;

      const untilNext = msUntilNextReminder(prefs, new Date());
      // Nothing armed still schedules a wake-up, cheaply — the user may enable
      // a reminder in another tab while this one sits idle.
      const delay = Math.min(untilNext ?? MAX_SLEEP_MS, MAX_SLEEP_MS);
      timer.current = setTimeout(tick, Math.max(delay, 1000));
    };

    void tick();

    // Coming back to a backgrounded PWA is the most likely moment for a missed
    // reminder to still be inside its grace window.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer.current);
      void tick();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [revision]);

  return null;
}
