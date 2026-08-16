'use client';

import { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { QUOTE_ROTATION_MS, type MotivationQuote } from '@/types/quote';
import { cn } from '@/lib/utils';

/**
 * A motivational quote that swaps for a new one every 15 minutes.
 *
 * The first quote is rendered on the server and passed in, so the note is
 * there on first paint and still works with JavaScript disabled — the interval
 * only ever replaces it. A failed refresh keeps the quote already on screen.
 */
export function MotivationNote({
  initialQuote,
  className,
}: {
  initialQuote: MotivationQuote;
  className?: string;
}) {
  const [quote, setQuote] = useState(initialQuote);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch('/api/quotes');
        if (!response.ok) return;

        const data: unknown = await response.json();
        const next = (data as { quote?: MotivationQuote })?.quote;
        if (active && next?.text) setQuote(next);
      } catch {
        // Offline or the API is down — keep showing the current quote.
      }
    }

    const timer = setInterval(refresh, QUOTE_ROTATION_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <aside
      className={cn(
        'flex gap-3 rounded-2xl border bg-accent/40 p-4',
        className,
      )}
      aria-live="polite"
    >
      <Quote className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />

      <div key={quote.text} className="min-w-0 animate-in fade-in duration-500">
        <p className="text-pretty text-sm leading-relaxed text-accent-foreground">
          {quote.text}
        </p>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
          {quote.author ? <span>— {quote.author}</span> : null}
          {quote.source === 'zenquotes' ? (
            <a
              href="https://zenquotes.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded underline-offset-2 hover:underline"
            >
              via ZenQuotes
            </a>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
