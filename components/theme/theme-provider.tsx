'use client';

import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';

/** Kept in sync with the inline script in app/layout.tsx. */
export const THEME_STORAGE_KEY = 'mylyf-theme';

/** Used until the user picks something; kept in sync with that same script. */
export const DEFAULT_THEME: 'light' | 'dark' = 'dark';

type ThemeContextValue = {
  /** What the user chose — 'system' means "follow the OS". */
  theme: Theme;
  /** What is actually on screen right now. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Must match --background in app/globals.css and the script in app/layout.tsx. */
const ROOT_BACKGROUND = { light: 'hsl(320 30% 99%)', dark: 'hsl(315 22% 7%)' } as const;

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Makes native scrollbars, form controls and the caret match the theme.
  root.style.colorScheme = resolved;
  // The layout script sets this inline to avoid a flash; keep it in step,
  // since an inline style would otherwise outrank the stylesheet forever.
  root.style.backgroundColor = ROOT_BACKGROUND[resolved];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start at the default ('dark') on the server; the effect below reconciles
  // with whatever the inline script already read from localStorage, so there
  // is no flash.
  const [theme, setThemeState] = React.useState<Theme>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(DEFAULT_THEME);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Private mode / storage blocked — fall back to the default theme.
    }
    const initial: Theme =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_THEME;
    setThemeState(initial);
    setResolvedTheme(initial === 'system' ? systemTheme() : initial);
  }, []);

  // Re-render when the OS flips, but only while the user is on 'system'.
  React.useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    setResolvedTheme(next === 'system' ? systemTheme() : next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the choice still applies for this session.
    }
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
