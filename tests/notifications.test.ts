import { describe, expect, it } from 'vitest';
import {
  activeReminders,
  defaultPrefs,
  dueReminders,
  formatTimeOfDay,
  msUntilNextReminder,
  nextOccurrence,
  normalizePrefs,
  parseTimeOfDay,
  REMINDER_IDS,
  WELCOME_NOTIFICATION,
  type NotificationPrefs,
  type ReminderId,
} from '@/lib/notifications/reminders';

function prefsWith(entries: Partial<Record<ReminderId, string>>): NotificationPrefs {
  const prefs = defaultPrefs();
  prefs.enabled = true;
  for (const [id, time] of Object.entries(entries)) {
    prefs.reminders[id as ReminderId] = { enabled: true, time: time as string };
  }
  return prefs;
}

const at = (hours: number, minutes = 0) => new Date(2026, 2, 14, hours, minutes, 0, 0);

describe('parseTimeOfDay', () => {
  it('parses a 24-hour wall time to minutes', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('07:30')).toBe(450);
    expect(parseTimeOfDay('23:59')).toBe(1439);
  });

  it('rejects anything that is not HH:MM', () => {
    for (const value of ['24:00', '7:30', '12:60', '', 'lunch', null, 730]) {
      expect(parseTimeOfDay(value)).toBeNull();
    }
  });
});

describe('formatTimeOfDay', () => {
  it('round-trips with parseTimeOfDay', () => {
    expect(formatTimeOfDay(450)).toBe('07:30');
    expect(parseTimeOfDay(formatTimeOfDay(1439))).toBe(1439);
  });

  it('wraps rather than emitting an invalid hour', () => {
    expect(formatTimeOfDay(1440)).toBe('00:00');
    expect(formatTimeOfDay(-60)).toBe('23:00');
  });
});

describe('defaultPrefs', () => {
  it('starts switched off, with every reminder off and nothing sent yet', () => {
    const prefs = defaultPrefs();
    expect(prefs.enabled).toBe(false);
    expect(prefs.welcomed).toBe(false);
    expect(Object.values(prefs.reminders).every((r) => !r.enabled)).toBe(true);
    // Times are still seeded, so turning a row on needs no extra decision.
    expect(Object.values(prefs.reminders).every((r) => parseTimeOfDay(r.time) !== null))
      .toBe(true);
  });
});

describe('normalizePrefs', () => {
  it('falls back to defaults for junk input', () => {
    for (const value of [null, undefined, 'nope', 42, []]) {
      const prefs = normalizePrefs(value);
      expect(prefs.enabled).toBe(false);
      expect(prefs.welcomed).toBe(false);
      expect(Object.keys(prefs.reminders).sort()).toEqual([...REMINDER_IDS].sort());
    }
  });

  it('keeps valid stored values and repairs invalid times', () => {
    const prefs = normalizePrefs({
      enabled: true,
      reminders: {
        lunch: { enabled: true, time: '12:15' },
        dinner: { enabled: true, time: '99:99' },
        ghost_meal: { enabled: true, time: '01:00' },
      },
    });

    expect(prefs.enabled).toBe(true);
    expect(prefs.reminders.lunch).toEqual({ enabled: true, time: '12:15' });
    expect(parseTimeOfDay(prefs.reminders.dinner.time)).not.toBeNull();
    expect('ghost_meal' in prefs.reminders).toBe(false);
  });
});

describe('the one-off welcome notification', () => {
  it('is pending on a fresh install and remembered once sent', () => {
    expect(normalizePrefs(null).welcomed).toBe(false);
    // Written back by the hook after the first opt-in; a later off/on is quiet.
    expect(normalizePrefs({ enabled: false, welcomed: true }).welcomed).toBe(true);
  });

  it('points somewhere real, like every other reminder', () => {
    expect(WELCOME_NOTIFICATION.body.length).toBeGreaterThan(0);
    expect(WELCOME_NOTIFICATION.url.startsWith('/')).toBe(true);
  });
});

describe('activeReminders', () => {
  it('is empty while the master switch is off', () => {
    const prefs = prefsWith({ lunch: '13:00' });
    prefs.enabled = false;
    expect(activeReminders(prefs)).toEqual([]);
  });

  it('lists only the rows that are on', () => {
    const prefs = prefsWith({ lunch: '13:00', journal: '21:30' });
    expect(activeReminders(prefs).map((meta) => meta.id)).toEqual(['lunch', 'journal']);
  });
});

describe('nextOccurrence', () => {
  it('picks today when the time is still ahead', () => {
    expect(nextOccurrence('13:00', at(9))?.getTime()).toBe(at(13).getTime());
  });

  it('rolls to tomorrow once the time has passed', () => {
    const next = nextOccurrence('08:00', at(9));
    expect(next?.getDate()).toBe(15);
    expect(next?.getHours()).toBe(8);
  });

  it('treats the exact minute as already gone', () => {
    expect(nextOccurrence('09:00', at(9))?.getDate()).toBe(15);
  });

  it('returns null for an unusable time', () => {
    expect(nextOccurrence('nope', at(9))).toBeNull();
  });
});

describe('msUntilNextReminder', () => {
  it('returns the soonest of the enabled reminders', () => {
    const prefs = prefsWith({ lunch: '13:00', dinner: '20:00' });
    expect(msUntilNextReminder(prefs, at(9))).toBe(4 * 60 * 60 * 1000);
  });

  it('is null when nothing is armed', () => {
    expect(msUntilNextReminder(defaultPrefs(), at(9))).toBeNull();
  });
});

describe('dueReminders', () => {
  const prefs = prefsWith({ breakfast: '08:00', lunch: '13:00' });

  it('fires a reminder at its time', () => {
    expect(dueReminders(prefs, at(8), {}).map((m) => m.id)).toEqual(['breakfast']);
  });

  it('still fires shortly after, for a throttled or resumed tab', () => {
    expect(dueReminders(prefs, at(8, 30), {}).map((m) => m.id)).toEqual(['breakfast']);
  });

  it('skips one missed by more than the grace window', () => {
    expect(dueReminders(prefs, at(11), {})).toEqual([]);
  });

  it('does not fire before its time', () => {
    expect(dueReminders(prefs, at(7, 59), {})).toEqual([]);
  });

  it('fires at most once a day', () => {
    expect(dueReminders(prefs, at(8, 5), { breakfast: '2026-03-14' })).toEqual([]);
    // Yesterday's record must not suppress today's nudge.
    expect(dueReminders(prefs, at(8, 5), { breakfast: '2026-03-13' }).map((m) => m.id))
      .toEqual(['breakfast']);
  });

  it('returns nothing while the master switch is off', () => {
    const off = { ...prefs, enabled: false };
    expect(dueReminders(off, at(8), {})).toEqual([]);
  });
});
