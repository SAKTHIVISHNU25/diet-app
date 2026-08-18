/**
 * Reminder preferences and scheduling maths.
 *
 * These are *local* notifications, not push: there is no server, no
 * subscription and no FCM token. The app schedules a timer while it is running
 * (a tab, or the installed PWA) and posts a notification when one comes due.
 * That is an honest fit for what this app is — a personal tracker someone opens
 * daily — and it costs nothing to run. The trade-off is stated plainly in the
 * settings UI: reminders only arrive while the app is open somewhere.
 *
 * Everything in this module is pure except the two storage helpers at the
 * bottom, which is what makes the timing logic testable.
 */

export type ReminderId = 'breakfast' | 'lunch' | 'dinner' | 'weigh_in' | 'journal';

export interface Reminder {
  enabled: boolean;
  /** 24-hour local wall time, "HH:MM". Not an instant — it means "every day". */
  time: string;
}

export interface NotificationPrefs {
  /** Master switch. Off means nothing is scheduled, whatever the rows say. */
  enabled: boolean;
  /**
   * Whether the one-off confirmation notification has already been sent. It
   * fires the first time the switch is turned on and never again, so toggling
   * off and back on later is silent.
   */
  welcomed: boolean;
  reminders: Record<ReminderId, Reminder>;
}

export interface ReminderMeta {
  id: ReminderId;
  label: string;
  /** Notification body. Written as a nudge, never a scolding. */
  body: string;
  /** Where tapping the notification should land. */
  url: string;
}

export const REMINDERS: readonly ReminderMeta[] = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    body: 'Morning. What did breakfast look like?',
    url: '/scan',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    body: 'Lunch time — a photo is enough.',
    url: '/scan',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    body: 'Dinner logged? Takes ten seconds.',
    url: '/scan',
  },
  {
    id: 'weigh_in',
    label: 'Weigh-in',
    body: 'Time to step on the scale and log the number.',
    url: '/progress',
  },
  {
    id: 'journal',
    label: 'Journal',
    body: 'How did today actually feel?',
    url: '/journal',
  },
] as const;

export const REMINDER_IDS = REMINDERS.map((reminder) => reminder.id);

/**
 * Sent once, the moment reminders are switched on. Permission being granted
 * says nothing about whether notifications actually reach the user — the OS
 * may have the app muted, or focus mode on — so proving it works immediately
 * is worth one interruption.
 */
export const WELCOME_NOTIFICATION: ReminderMeta = {
  id: 'breakfast',
  label: 'Reminders are on',
  body: 'This is the only one you did not ask for. The rest arrive at your times.',
  url: '/profile',
};

const DEFAULT_TIMES: Record<ReminderId, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  dinner: '20:00',
  weigh_in: '07:30',
  journal: '21:30',
};

/**
 * Everything off by default. A tracker that starts buzzing without being asked
 * is one people turn off entirely, so opting in is a deliberate act.
 */
export function defaultPrefs(): NotificationPrefs {
  return {
    enabled: false,
    welcomed: false,
    reminders: Object.fromEntries(
      REMINDER_IDS.map((id) => [id, { enabled: false, time: DEFAULT_TIMES[id] }]),
    ) as Record<ReminderId, Reminder>,
  };
}

/** "HH:MM" -> minutes since local midnight, or null if it is not a valid time. */
export function parseTimeOfDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 465 -> "07:45". Wraps, so callers cannot produce "24:15". */
export function formatTimeOfDay(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  return `${hours}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** "07:45" -> "7:45 AM" in the user's locale, for display only. */
export function formatTimeLabel(time: string): string {
  const minutes = parseTimeOfDay(time);
  if (minutes === null) return time;
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Stored JSON is user-writable (it is localStorage) and may predate a change to
 * the reminder list, so every field is re-derived rather than trusted.
 */
export function normalizePrefs(value: unknown): NotificationPrefs {
  const base = defaultPrefs();
  if (!value || typeof value !== 'object') return base;

  const row = value as Record<string, unknown>;
  const stored = (row.reminders ?? {}) as Record<string, unknown>;

  for (const id of REMINDER_IDS) {
    const entry = stored[id];
    if (!entry || typeof entry !== 'object') continue;
    const { enabled, time } = entry as Record<string, unknown>;
    base.reminders[id] = {
      enabled: enabled === true,
      time: parseTimeOfDay(time) === null ? DEFAULT_TIMES[id] : (time as string),
    };
  }

  base.enabled = row.enabled === true;
  base.welcomed = row.welcomed === true;
  return base;
}

/** The reminders that are actually armed: master switch on, row on, time valid. */
export function activeReminders(prefs: NotificationPrefs): ReminderMeta[] {
  if (!prefs.enabled) return [];
  return REMINDERS.filter((meta) => {
    const reminder = prefs.reminders[meta.id];
    return reminder?.enabled === true && parseTimeOfDay(reminder.time) !== null;
  });
}

/** The next instant this daily time comes round, strictly after `from`. */
export function nextOccurrence(time: string, from: Date): Date | null {
  const minutes = parseTimeOfDay(time);
  if (minutes === null) return null;

  const next = new Date(from);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  // setHours on a DST boundary can land before `from`; a day step still fixes
  // it, because a repeated hour only ever pulls the wall time backwards once.
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * A reminder is due when its wall time has passed today, it has not already
 * fired today, and we are still within the grace window.
 *
 * The window matters because timers in a backgrounded tab are throttled and
 * phones sleep: without it, opening the app at 11pm would deliver the 8am
 * breakfast nudge, which is noise. With it, a reminder that was missed by more
 * than `graceMinutes` is simply skipped until tomorrow.
 */
export const GRACE_MINUTES = 45;

export function dueReminders(
  prefs: NotificationPrefs,
  now: Date,
  lastFired: Record<string, string>,
  graceMinutes: number = GRACE_MINUTES,
): ReminderMeta[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = isoDate(now);

  return activeReminders(prefs).filter((meta) => {
    const scheduled = parseTimeOfDay(prefs.reminders[meta.id].time);
    if (scheduled === null) return false;
    const late = nowMinutes - scheduled;
    if (late < 0 || late > graceMinutes) return false;
    return lastFired[meta.id] !== today;
  });
}

/**
 * Milliseconds until the next scheduled reminder, for arming a single timer.
 * Null when nothing is armed. Capped by the caller, not here.
 */
export function msUntilNextReminder(
  prefs: NotificationPrefs,
  now: Date,
): number | null {
  const times = activeReminders(prefs)
    .map((meta) => nextOccurrence(prefs.reminders[meta.id].time, now))
    .filter((date): date is Date => date !== null)
    .map((date) => date.getTime() - now.getTime());

  if (times.length === 0) return null;
  return Math.max(0, Math.min(...times));
}

/** Local YYYY-MM-DD. Local, not UTC: reminders are wall-clock things. */
function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Preferences are per-device on purpose.
 *
 * Notification permission is granted to a browser, not to an account, and only
 * the device you are holding can raise the notification. Syncing these to the
 * profile would promise a phone reminder that a laptop had quietly enabled.
 */
export const PREFS_KEY = 'mylyf:notifications';
const FIRED_KEY = 'mylyf:notifications-fired';

export function loadPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return normalizePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    // Private-mode storage errors and corrupt JSON both mean "no preferences".
    return defaultPrefs();
  }
}

export function savePrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Nothing useful to do — the UI state stays correct for this session.
  }
}

export function loadLastFired(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function markFired(id: ReminderId, now: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  try {
    const fired = loadLastFired();
    fired[id] = isoDate(now);
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    // Worst case a reminder repeats once; better than dropping it silently.
  }
}
