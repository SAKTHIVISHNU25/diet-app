'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Camera,
  History,
  Home,
  LineChart,
  NotebookPen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/scan', label: 'Scan', icon: Camera },
  { href: '/diet-plan', label: 'Diet', icon: CalendarDays },
  { href: '/history', label: 'History', icon: History },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/progress', label: 'Progress', icon: LineChart },
] as const;

/**
 * Fixed bottom navigation. Each target is a full-height 64px+ tap area, and the
 * bar sits above the home indicator via env(safe-area-inset-bottom).
 */
export function MobileNav() {
  const pathname = usePathname();

  // Onboarding is a focused flow — the nav would invite people to skip it.
  if (pathname.startsWith('/onboarding')) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm pb-safe"
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                {/* Six targets on a 320px screen leaves ~53px each, so the
                    label has to be allowed to clip rather than push the bar. */}
                <span className="w-full truncate px-0.5 text-center">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
