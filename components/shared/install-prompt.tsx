'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

const DISMISSED_KEY = 'mylyf:install-dismissed';

/**
 * Chrome install banner.
 *
 * Shown only when Chrome has actually fired `beforeinstallprompt` (so the app
 * genuinely meets the install criteria), never when already running standalone,
 * and never again once dismissed.
 *
 * Browsers other than Chromium do not fire this event — see docs/PWA.md.
 */
export function InstallPrompt() {
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  // Read from localStorage after mount so server and client markup match.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!canInstall || isStandalone || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing can block localStorage; the banner just returns later.
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p id="install-title" className="text-sm font-medium">
            Install MyLyf
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add it to your home screen for a full-screen, app-like experience.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={async () => {
            const outcome = await promptInstall();
            // "dismissed" here means the native dialog was declined; do not
            // nag again in this session either way.
            if (outcome !== 'unavailable') dismiss();
          }}
        >
          Install
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
