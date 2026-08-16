import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ServiceWorkerRegistrar } from '@/components/shared/service-worker-registrar';
import './globals.css';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#160e14' },
  ],
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
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
