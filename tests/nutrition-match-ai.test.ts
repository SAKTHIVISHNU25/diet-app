import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodItem } from '@/types/food';
import { pickBestMatch } from '@/lib/nutrition/match-ai';

/**
 * The disambiguator is advisory: it may improve the ranking, but it must never
 * be able to break a lookup. Most of these tests are about it failing quietly.
 */

function food(name: string, calories: number, protein: number): FoodItem {
  return {
    name,
    source: 'usda',
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: 0,
    fatPer100g: 0,
  };
}

const CANDIDATES: FoodItem[] = [
  food('Carrot, dehydrated', 341, 8.1),
  food('Carrots, raw', 41, 0.93),
  food('Carrot juice, canned', 40, 0.95),
];

/** A chat-completion response carrying `content` as the assistant message. */
function reply(content: string) {
  return Response.json({ choices: [{ message: { content } }] });
}

function mockFetch(content: string) {
  const fn = vi.fn().mockResolvedValue(reply(content));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.stubEnv('HF_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('pickBestMatch', () => {
  it('returns the zero-based index of the chosen candidate', async () => {
    mockFetch('{"pick": 2}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBe(1);
  });

  it('reads a fenced or prose-wrapped reply', async () => {
    mockFetch('Here you go:\n```json\n{"pick": 2}\n```');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBe(1);
  });

  it('accepts the index as a string', async () => {
    mockFetch('{"pick": "2"}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBe(1);
  });

  it('keeps the keyword ranking when the model declines to choose', async () => {
    mockFetch('{"pick": null}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
  });

  it('rejects an index outside the candidate list', async () => {
    mockFetch('{"pick": 99}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();

    mockFetch('{"pick": 0}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();

    mockFetch('{"pick": -1}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
  });

  it('survives unparseable output', async () => {
    mockFetch('I think the second one looks right!');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
  });

  it('survives an error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
  });

  it('survives a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
  });

  it('does not call out at all without a token', async () => {
    vi.stubEnv('HF_TOKEN', '');
    const fn = mockFetch('{"pick": 2}');
    await expect(pickBestMatch('carrot', CANDIDATES)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not spend a call when there is nothing to disambiguate', async () => {
    const fn = mockFetch('{"pick": 1}');
    await expect(pickBestMatch('carrot', CANDIDATES.slice(0, 1))).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('shows the model each candidate with its per-100 g values', async () => {
    const fn = mockFetch('{"pick": 2}');
    await pickBestMatch('carrot', CANDIDATES);

    const body = JSON.parse((fn.mock.calls[0]![1] as RequestInit).body as string);
    const prompt = body.messages[0].content as string;

    expect(prompt).toContain('"carrot"');
    expect(prompt).toContain('1. Carrot, dehydrated — 341 kcal, 8.1 g protein');
    expect(prompt).toContain('2. Carrots, raw — 41 kcal, 0.93 g protein');
    // Selection, not generation — the model must never invent a number.
    expect(body.temperature).toBe(0);
  });
});
