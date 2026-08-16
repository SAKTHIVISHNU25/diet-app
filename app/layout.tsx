import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ServiceWorkerRegistrar } from '@/components/shared/service-worker-registrar';
import { ThemeProvider, THEME_STORAGE_KEY } from '@/components/theme/theme-provider';
import { ThemedToaster } from '@/components/theme/themed-toaster';
import './globals.css';

/**
 * Runs before first paint so a dark-theme user never sees a white flash.
 * Dark is the default: only an explicit stored choice can turn it off.
 * Deliberately tiny and dependency-free — it must stay render-blocking.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored === 'dark' || !stored || (stored === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
    // Painted before globals.css loads, otherwise the first frame is the
    // browser's white canvas. Must match --background in app/globals.css.
    root.style.backgroundColor = dark ? 'hsl(315 22% 7%)' : 'hsl(320 30% 99%)';
  } catch (e) {
    document.documentElement.style.backgroundColor = 'hsl(315 22% 7%)';
  }
})();
`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MyLyf — Calorie & Nutrition Tracker',
    template: '%s | MyLyf',
  },
  description:
    'Track calories and macros, scan meals with open-source food recognition, and follow a personalised 7-day diet plan.',
  applicationName: 'MyLyf',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MyLyf',
    statusBarStyle: 'default',
  },
  // Icon <link> tags come from the app/icon.png and app/apple-icon.png file
  // conventions; the PWA icon set lives in public/manifest.webmanifest.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Dark is the default theme, so the browser chrome matches it unconditionally.
  themeColor: '#160e14',
  width: 'device-width',
  initialScale: 1,
  // Users must be able to zoom — capping this would fail WCAG 1.4.4.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          {children}
          <ThemedToaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
