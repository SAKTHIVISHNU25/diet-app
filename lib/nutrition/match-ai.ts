import 'server-only';

import type { FoodItem } from '@/types/food';

/**
 * AI disambiguation of USDA search results.
 *
 * The scoring in `rankResults` is keyword-based, so it only knows the traps it
 * has been told about. It learned "dehydrated" and "candied" the hard way, one
 * production bug at a time, and there is an unbounded supply of them: USDA
 * returns "Carrot, dehydrated" (341 kcal) for `carrot`, "Banana" the branded
 * snack bar (312 kcal) for `banana`, "Dosa mix" the dry flour for `dosa`.
 *
 * Choosing between candidate rows is a judgement task, which is what a language
 * model is actually good at. It is asked to *pick an index*, never to produce a
 * number — every macro still comes from USDA, with its fdcId intact, so the
 * result stays sourceable and reproducible.
 *
 * This is strictly advisory. Any failure — no token, timeout, bad JSON, an
 * index out of range — leaves the keyword ranking in place. It must never be
 * able to make a lookup fail.
 */

const DEFAULT_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct:featherless-ai';
const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1/chat/completions';

/**
 * Short on purpose. This runs inline in the scan flow, and a slow answer is
 * worse than the keyword ranking we already have.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/** Enough candidates for the right one to be present; few enough to stay cheap. */
export const MAX_CANDIDATES = 8;

function buildPrompt(query: string, candidates: FoodItem[]): string {
  const rows = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}${c.brand ? ` [brand: ${c.brand}]` : ''} — ` +
        `${c.caloriesPer100g} kcal, ${c.proteinPer100g} g protein, ` +
        `${c.carbsPer100g} g carbs, ${c.fatPer100g} g fat (per 100 g)`,
    )
    .join('\n');

  return `A user logged a food in a diet tracker and typed: "${query}"

Below are candidate entries from the USDA nutrition database. Pick the one that best matches what the user most likely ate.

${rows}

Rules:
- Assume the ordinary, ready-to-eat form unless the user's words say otherwise. A user who types "carrot" means a fresh carrot, not dehydrated carrot, carrot juice or carrot cake.
- Reject entries whose per-100 g values are implausible for the food named. Dehydrated and powdered forms have several times the calories of the fresh food.
- Prefer a generic entry over a specific brand unless the user named the brand.
- If the user's words DO specify a form (e.g. "dried mango", "apple juice"), pick the entry matching that form.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"pick": <number from 1 to ${candidates.length}, or null if none is a reasonable match>}`;
}

/**
 * Ask the model which candidate matches. Returns the chosen index into
 * `candidates`, or null to keep the existing order.
 */
export async function pickBestMatch(
  query: string,
  candidates: FoodItem[],
): Promise<number | null> {
  const token = process.env.HF_TOKEN;
  if (!token) return null;
  // Nothing to disambiguate.
  if (candidates.length < 2) return null;

  const model = process.env.HF_MATCH_MODEL || process.env.HF_VLM_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.HF_VLM_URL || DEFAULT_BASE_URL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // Selection, not generation.
        temperature: 0,
        max_tokens: 20,
        messages: [{ role: 'user', content: buildPrompt(query, candidates) }],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`[nutrition:match-ai] ${response.status} — keeping keyword ranking`);
      return null;
    }

    const json: unknown = await response.json();
    const content = extractMessageContent(json);
    if (!content) return null;

    const pick = parsePick(content);
    if (pick == null) return null;

    // Guard the index: the model is free to return anything.
    const index = pick - 1;
    return index >= 0 && index < candidates.length ? index : null;
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'error';
    console.warn(`[nutrition:match-ai] ${reason} — keeping keyword ranking`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractMessageContent(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;
  return typeof content === 'string' ? content : null;
}

/** Read `{"pick": n}` out of the reply, tolerating fences and stray prose. */
function parsePick(content: string): number | null {
  const attempts: string[] = [content.trim()];

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(content.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as { pick?: unknown };
      const pick = parsed?.pick;
      if (typeof pick === 'number' && Number.isInteger(pick)) return pick;
      // The model sometimes answers with the number as a string.
      if (typeof pick === 'string' && /^\d+$/.test(pick.trim())) {
        return Number.parseInt(pick, 10);
      }
      // An explicit null means "none of these" — keep the keyword order.
      if (pick === null) return null;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}
