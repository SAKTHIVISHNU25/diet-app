'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadPrefs,
  savePrefs,
  WELCOME_NOTIFICATION,
  type NotificationPrefs,
  type ReminderId,
} from '@/lib/notifications/reminders';
import {
  notificationPermission,
  notificationsSupported,
  showReminderNotification,
} from '@/lib/notifications/notify';

export interface UseNotifications {
  /** False on browsers without the Notification API — the UI explains instead. */
  supported: boolean;
  permission: NotificationPermission;
  prefs: NotificationPrefs;
  /** Null until the first effect runs; prevents a hydration mismatch. */
  ready: boolean;
  setMasterEnabled: (enabled: boolean) => Promise<void>;
  setReminderEnabled: (id: ReminderId, enabled: boolean) => void;
  setReminderTime: (id: ReminderId, time: string) => void;
}

/**
 * Reads and writes the local reminder preferences, and owns the one moment
 * where permission is requested — turning the master switch on. Browsers only
 * grant permission from a user gesture, and asking on page load is the surest
 * way to be denied permanently.
 */
export function useNotifications(): UseNotifications {
  // Server render and first client render must agree, so the stored values are
  // read in an effect rather than during render.
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSupported(notificationsSupported());
    setPermission(notificationPermission());
    setPrefs(loadPrefs());
    setReady(true);
  }, []);

  const update = useCallback((next: NotificationPrefs) => {
    setPrefs(next);
    savePrefs(next);
    // The scheduler lives in the layout, outside this tree: tell it to re-arm.
    window.dispatchEvent(new Event('mylyf:notifications-changed'));
  }, []);

  const setMasterEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        update({ ...prefs, enabled: false });
        return;
      }

      if (!notificationsSupported()) return;

      let granted = Notification.permission;
      if (granted === 'default') granted = await Notification.requestPermission();
      setPermission(granted);

      // Denied is a browser-level setting we cannot undo from here, so the
      // switch stays off rather than pretending to be on.
      if (granted !== 'granted') {
        update({ ...prefs, enabled: false });
        return;
      }

      // One confirmation on the very first opt-in, so the user sees what a
      // reminder looks like — and learns straight away if the OS is muting
      // them — without waiting until tomorrow morning. `welcomed` is sticky,
      // so switching off and on again later stays quiet.
      const welcome = !prefs.welcomed;
      update({ ...prefs, enabled: true, welcomed: true });
      if (welcome) await showReminderNotification(WELCOME_NOTIFICATION);
    },
    [prefs, update],
  );

  const setReminderEnabled = useCallback(
    (id: ReminderId, enabled: boolean) => {
      update({
        ...prefs,
        reminders: { ...prefs.reminders, [id]: { ...prefs.reminders[id], enabled } },
      });
    },
    [prefs, update],
  );

  const setReminderTime = useCallback(
    (id: ReminderId, time: string) => {
      update({
        ...prefs,
        reminders: { ...prefs.reminders, [id]: { ...prefs.reminders[id], time } },
      });
    },
    [prefs, update],
  );

  return {
    supported,
    permission,
    prefs,
    ready,
    setMasterEnabled,
    setReminderEnabled,
    setReminderTime,
  };
}
