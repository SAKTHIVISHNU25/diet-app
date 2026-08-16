'use client';

import { Toaster } from 'sonner';
import { useTheme } from '@/components/theme/theme-provider';

/** Sonner defaults to light; keep toasts in step with the chosen theme. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster theme={resolvedTheme} position="top-center" richColors closeButton />
  );
}
