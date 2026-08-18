'use client';

import { BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/use-notifications';
import { showReminderNotification } from '@/lib/notifications/notify';
import { REMINDERS, formatTimeLabel } from '@/lib/notifications/reminders';
import { cn } from '@/lib/utils';

/**
 * The notifications section of the profile.
 *
 * Two things it is careful to be honest about: reminders live on this device
 * only (permission is granted per browser), and they arrive only while the app
 * is open, because there is no push server behind them.
 */
export function NotificationsCard({ className }: { className?: string }) {
  const {
    supported,
    permission,
    prefs,
    ready,
    setMasterEnabled,
    setReminderEnabled,
    setReminderTime,
  } = useNotifications();

  if (ready && !supported) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        This browser cannot show notifications. On iPhone, add MyLyf to your home
        screen with iOS 16.4 or later and reminders become available.
      </p>
    );
  }

  const blocked = permission === 'denied';
  const on = prefs.enabled && !blocked;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          {on ? (
            <BellRing className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <BellOff
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <div>
            <p className="text-sm font-medium">Reminders on this device</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {blocked
                ? 'Notifications are blocked in your browser settings. Allow them for this site, then turn this back on.'
                : 'Nudges to log a meal, weigh in or journal. They arrive while MyLyf is open — installed to your home screen, that includes the background.'}
            </p>
          </div>
        </div>
        <Switch
          checked={on}
          disabled={!ready || blocked}
          onCheckedChange={(next) => void setMasterEnabled(next)}
          aria-label="Enable reminders on this device"
        />
      </div>

      <div
        className={cn(
          'space-y-1 transition-opacity',
          on ? 'opacity-100' : 'pointer-events-none opacity-50',
        )}
        aria-hidden={!on}
      >
        {REMINDERS.map((meta) => {
          const reminder = prefs.reminders[meta.id];
          return (
            <div
              key={meta.id}
              className="flex items-center justify-between gap-3 rounded-lg px-1 py-2"
            >
              <div className="min-w-0">
                <label
                  htmlFor={`reminder-time-${meta.id}`}
                  className="text-sm font-medium"
                >
                  {meta.label}
                </label>
                <p className="text-xs text-muted-foreground">
                  {reminder.enabled
                    ? `Daily at ${formatTimeLabel(reminder.time)}`
                    : 'Off'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  id={`reminder-time-${meta.id}`}
                  type="time"
                  value={reminder.time}
                  disabled={!on || !reminder.enabled}
                  onChange={(event) => setReminderTime(meta.id, event.target.value)}
                  className="w-32"
                />
                <Switch
                  checked={reminder.enabled}
                  disabled={!on}
                  onCheckedChange={(next) => setReminderEnabled(meta.id, next)}
                  aria-label={`${meta.label} reminder`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!on}
        onClick={async () => {
          const shown = await showReminderNotification({
            id: 'breakfast',
            label: 'MyLyf',
            body: 'This is what a reminder looks like.',
            url: '/dashboard',
          });
          if (!shown) toast.error('Could not show a notification on this device.');
        }}
      >
        Send a test notification
      </Button>
    </div>
  );
}
