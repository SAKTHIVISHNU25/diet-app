'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/theme-provider';

/**
 * Compact light/dark flip for page headers. The three-way picker (including
 * "System") lives on the profile page.
 *
 * Both icons are always rendered and swapped by the `dark` class rather than by
 * React state, so the correct one is painted immediately — the inline script in
 * the root layout sets that class before hydration.
 */
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-5 dark:hidden" aria-hidden />
      <Moon className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}
