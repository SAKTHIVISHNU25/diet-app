import type { ReminderMeta } from '@/lib/notifications/reminders';

/** True when this browser can show notifications at all (Safari < 16.4 cannot). */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

/**
 * Shows a reminder.
 *
 * Android Chrome throws on the `new Notification()` constructor when a service
 * worker is in charge, so the registration is tried first and the constructor
 * is only the desktop fallback. Failure is swallowed: a missed nudge must never
 * surface as an error in a diet app.
 */
export async function showReminderNotification(meta: ReminderMeta): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body: meta.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One tag per reminder, so a stale nudge is replaced rather than stacked.
    tag: `mylyf-${meta.id}`,
    data: { url: meta.url },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(meta.label, options);
      return true;
    }
  } catch {
    // Fall through to the constructor below.
  }

  try {
    new Notification(meta.label, options);
    return true;
  } catch {
    return false;
  }
}
