export interface MotivationQuote {
  text: string;
  author: string | null;
  /** 'zenquotes' requires visible attribution under their free-tier terms. */
  source: 'zenquotes' | 'local';
}

/** How long a quote stays on screen before the next one replaces it. */
export const QUOTE_ROTATION_MS = 15 * 60 * 1000;
