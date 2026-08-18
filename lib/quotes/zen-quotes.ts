import 'server-only';

import { QUOTE_ROTATION_MS, type MotivationQuote } from '@/types/quote';

/**
 * Motivational quotes from the ZenQuotes API.
 *
 * The free tier is rate limited per IP, so we pull a batch of quotes and hold
 * it for the rotation window — one upstream request every 15 minutes serves
 * every user and every refresh in between.
 *
 * A quote is decoration on the journal and progress pages, so it is never
 * allowed to hold up a render. `getMotivationQuote()` answers from whatever is
 * already in memory and returns immediately; a stale or missing pool triggers
 * a *background* refresh that the current request does not wait on. The very
 * first request after a cold start therefore serves the local fallback rather
 * than paying for the upstream round trip.
 */

const ENDPOINT = 'https://zenquotes.io/api/quotes';

const REVALIDATE_SECONDS = QUOTE_ROTATION_MS / 1000;
const REQUEST_TIMEOUT_MS = 5000;
/** Long quotes wrap into a wall of text on a phone. */
const MAX_LENGTH = 160;

/**
 * Written in the app's own voice — no attribution, so nothing can be
 * misattributed to a real person when the API is unreachable.
 */
const DEFAULT_QUOTE: MotivationQuote = {
  text: 'Small changes, repeated, beat big changes attempted once.',
  author: null,
  source: 'local',
};

const FALLBACK: MotivationQuote[] = [
  DEFAULT_QUOTE,
  ...[
    'The scale measures one day. The trend measures you.',
    'Progress is a direction, not a straight line.',
    'A weigh-in is data, not a verdict.',
    'You do not have to be perfect today. Just present.',
    'The habit is the goal — the number follows.',
    'Show up on the days that do not feel special.',
    'Slow progress you can keep is faster than fast progress you cannot.',
    'Compare today to where you started, not to someone else.',
    'The best plan is the one you will still be following next month.',
  ].map((text) => ({ text, author: null, source: 'local' as const })),
];

/** The batch in memory, plus when it was fetched and any refresh in flight. */
let pool: MotivationQuote[] = FALLBACK;
let fetchedAt = 0;
let refreshing: Promise<void> | null = null;

/**
 * One quote, picked at random from the batch held in memory.
 *
 * Synchronous in practice — it never awaits the network. Kept `async` because
 * every caller already awaits it and the pages read better that way.
 */
export async function getMotivationQuote(): Promise<MotivationQuote> {
  if (isStale()) void refreshPool();
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_QUOTE;
}

function isStale(): boolean {
  return Date.now() - fetchedAt >= QUOTE_ROTATION_MS;
}

/**
 * Replace the pool from upstream. Only one refresh runs at a time, and the
 * timestamp is stamped even on failure so a dead endpoint is retried once per
 * rotation window rather than on every single request.
 */
async function refreshPool(): Promise<void> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      pool = await fetchQuotePool();
    } finally {
      fetchedAt = Date.now();
      refreshing = null;
    }
  })();

  return refreshing;
}

async function fetchQuotePool(): Promise<MotivationQuote[]> {
  try {
    const response = await fetch(ENDPOINT, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return FALLBACK;

    const payload: unknown = await response.json();
    const quotes = (Array.isArray(payload) ? payload : [])
      .map(toQuote)
      .filter((quote): quote is MotivationQuote => quote !== null);

    return quotes.length > 0 ? quotes : FALLBACK;
  } catch (error) {
    console.error('[quotes:zen]', error);
    return FALLBACK;
  }
}

function toQuote(row: unknown): MotivationQuote | null {
  if (typeof row !== 'object' || row === null) return null;

  const { q, a } = row as { q?: unknown; a?: unknown };
  const text = typeof q === 'string' ? q.trim() : '';
  const author = typeof a === 'string' ? a.trim() : '';

  if (!text || text.length > MAX_LENGTH) return null;
  // When rate limited, ZenQuotes returns its notice in the shape of a quote.
  if (author.toLowerCase() === 'zenquotes.io') return null;

  return { text, author: author || null, source: 'zenquotes' };
}
