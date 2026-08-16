'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Camera,
  Heart,
  LineChart,
  NotebookPen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MyLyfMark } from '@/components/shared/logo';
import { cn } from '@/lib/utils';

const SEEN_KEY = 'mylyf:tour-seen';

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

/**
 * Five taps, all skippable. This is a note from him, not a manual — each card
 * says why a thing exists, never how to work it. The screens themselves are
 * plain enough to explain the how.
 */
const STEPS: [Step, ...Step[]] = [
  {
    icon: Heart,
    title: 'Hey you 💐',
    body:
      'Your boyfriend made this one for us — a small, private place to look after our wellbeing together. Here is what he had in mind.',
  },
  {
    icon: Camera,
    title: 'He got tired of you guessing',
    body:
      'So the camera does the counting now. Show it your plate and it works the rest out. That is all Scan is.',
  },
  {
    icon: CalendarDays,
    title: 'A plan you did not have to build',
    body:
      'Diet is what he set up around your goals, so there is one less thing to decide. History is every day you have shown up — kept, in case you ever doubt yourself.',
  },
  {
    icon: NotebookPen,
    title: 'Somewhere to put the day',
    body:
      'Journal is for how it actually felt, not how it looked. A mood, a line, whatever you have in you. The streak counts showing up, not writing well.',
  },
  {
    icon: LineChart,
    title: 'One small warning 🙈',
    body:
      'It is still a work in progress, so a bug might pop up here and there. Do not mind those — just tell him and he will fix it. Progress is where you will see it all add up.',
  },
];

/**
 * One-time welcome tour, shown on the first page after onboarding is done.
 *
 * Waiting for `onboarded` matters: signup drops people straight into the
 * profile form, and a greeting over the top of it would be one interruption
 * too many. Whether it has been seen is kept in localStorage, read after mount
 * so server and client markup stay identical.
 */
export function WelcomeTour({ onboarded }: { onboarded: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!onboarded) return;

    try {
      if (window.localStorage.getItem(SEEN_KEY) !== '1') setOpen(true);
    } catch {
      // Private browsing can block localStorage. Showing it once per visit is
      // friendlier than never showing it at all.
      setOpen(true);
    }
  }, [onboarded]);

  const finish = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // See above — nothing to recover, the tour simply returns next visit.
    }
  };

  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      // Closing by overlay tap or Escape counts as seen — nobody wants this twice.
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogContent className="max-w-sm gap-5 overflow-hidden">
        {/* A soft wash behind the icon so the card feels like a greeting card
            rather than a system dialog. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl"
        />

        <DialogHeader className="relative items-center pr-0 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            {step === 0 ? (
              <MyLyfMark className="size-8" />
            ) : (
              <Icon className="size-7" aria-hidden />
            )}
          </span>

          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-balance leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of {STEPS.length}
        </p>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={finish}
          >
            {isLast ? 'Close' : 'Skip'}
          </Button>
          <Button
            className="flex-1"
            onClick={isLast ? finish : () => setStep((s) => s + 1)}
          >
            {isLast ? "Let's go 💛" : 'Next'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
