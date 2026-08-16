'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event. It is a Chromium-only, non-standard API, so
 * it is not in the DOM lib types and we declare the shape we use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Wraps Chrome's install flow.
 *
 * `canInstall` is true only after Chrome fires `beforeinstallprompt`, which it
 * does only when the app meets the installability criteria (manifest, service
 * worker, HTTPS). Firefox and Safari never fire it — there, installation is a
 * manual browser-menu action and no in-page prompt is possible.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const displayMode = window.matchMedia('(display-mode: standalone)').matches;
      // iOS Safari uses a non-standard navigator.standalone instead.
      const iosStandalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(displayMode || iosStandalone);
    };

    checkStandalone();

    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', checkStandalone);

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's own mini-infobar so our banner is the only prompt.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      checkStandalone();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      media.removeEventListener('change', checkStandalone);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // The event can only be used once.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null,
    isStandalone,
    promptInstall,
  };
}
