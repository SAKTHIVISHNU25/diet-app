import 'server-only';

import { QUOTE_ROTATION_MS, type MotivationQuote } from '@/types/quote';

/**
 * Motivational quotes from the ZenQuotes API.
 *
 * The free tier is rate limited per IP, so we pull a batch of quotes and let
 * Next's fetch cache hold it for the rotation window — one upstream request
 * every 15 minutes serves every user and every refresh in between.
 *
 * Any failure falls back to a local list. A quote is decoration on the
 * progress page; it must never be able to break the page or slow it down.
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

/** One quote, picked at random from the cached batch. */
export async function getMotivationQuote(): Promise<MotivationQuote> {
  const pool = await fetchQuotePool();
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_QUOTE;
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
