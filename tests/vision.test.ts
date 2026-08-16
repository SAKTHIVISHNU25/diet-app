import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFoodVisionProvider,
  resetFoodVisionProvider,
  AVAILABLE_PROVIDERS,
} from '@/lib/vision/provider';
import { MockFoodProvider } from '@/lib/vision/mock';
import { HuggingFaceFoodProvider } from '@/lib/vision/huggingface';
import { CONFIDENCE_THRESHOLD, VisionError } from '@/lib/vision/types';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  resetFoodVisionProvider();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetFoodVisionProvider();
  vi.restoreAllMocks();
});

describe('provider registry', () => {
  it('lists the built-in providers', () => {
    expect(AVAILABLE_PROVIDERS).toContain('huggingface');
    expect(AVAILABLE_PROVIDERS).toContain('mock');
  });

  it('resolves the configured provider', () => {
    process.env.FOOD_VISION_PROVIDER = 'mock';
    expect(getFoodVisionProvider()).toBeInstanceOf(MockFoodProvider);

    resetFoodVisionProvider();
    process.env.FOOD_VISION_PROVIDER = 'huggingface';
    expect(getFoodVisionProvider()).toBeInstanceOf(HuggingFaceFoodProvider);
  });

  it('defaults to Hugging Face when unset', () => {
    delete process.env.FOOD_VISION_PROVIDER;
    expect(getFoodVisionProvider()).toBeInstanceOf(HuggingFaceFoodProvider);
  });

  it('falls back to mock rather than crashing on an unknown value', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.FOOD_VISION_PROVIDER = 'not-a-real-provider';
    expect(getFoodVisionProvider()).toBeInstanceOf(MockFoodProvider);
  });

  it('is case insensitive', () => {
    process.env.FOOD_VISION_PROVIDER = 'MOCK';
    expect(getFoodVisionProvider()).toBeInstanceOf(MockFoodProvider);
  });
});

describe('MockFoodProvider', () => {
  const provider = new MockFoodProvider();

  it('returns a single confident food', async () => {
    const result = await provider.analyzeImage({
      data: new Uint8Array(1234),
      mimeType: 'image/jpeg',
    });

    expect(result.foods).toHaveLength(1);
    expect(result.confident).toBe(true);
    expect(result.provider).toBe('mock');
  });

  it('is deterministic for identical input', async () => {
    const input = { data: new Uint8Array(999), mimeType: 'image/jpeg' };
    const a = await provider.analyzeImage(input);
    const b = await provider.analyzeImage(input);
    expect(a.foods[0]!.name).toBe(b.foods[0]!.name);
  });

  it('always supplies a starting portion', async () => {
    const result = await provider.analyzeImage({
      data: new Uint8Array(500),
      mimeType: 'image/jpeg',
    });

    const food = result.foods[0]!;
    expect(food.estimatedGrams).toBeGreaterThan(0);
    // The portion is a category default, never a measurement from the image.
    expect(food.portionSource).toBe('category_default');
  });

  it('says plainly that it is not a real identification', async () => {
    const result = await provider.analyzeImage({
      data: new Uint8Array(10),
      mimeType: 'image/jpeg',
    });
    expect(result.notes?.toLowerCase()).toContain('mock');
  });
});

describe('HuggingFaceFoodProvider', () => {
  it('reports not_configured when no token is set', async () => {
    delete process.env.HF_TOKEN;
    const provider = new HuggingFaceFoodProvider();

    await expect(
      provider.analyzeImage({ data: new Uint8Array(4), mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ kind: 'not_configured' });
  });

  it('maps upstream statuses to typed errors', async () => {
    process.env.HF_TOKEN = 'test-token';

    const cases = [
      { status: 401, kind: 'not_configured' },
      { status: 429, kind: 'rate_limited' },
      { status: 503, kind: 'model_loading' },
      { status: 500, kind: 'unavailable' },
    ] as const;

    for (const { status, kind } of cases) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status })),
      );

      const provider = new HuggingFaceFoodProvider();
      await expect(
        provider.analyzeImage({ data: new Uint8Array(4), mimeType: 'image/jpeg' }),
      ).rejects.toMatchObject({ kind });
    }
  });

  it('normalizes a classification response', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json([
          { label: 'chicken_curry', score: 0.82 },
          { label: 'pad_thai', score: 0.09 },
        ]),
      ),
    );

    const provider = new HuggingFaceFoodProvider();
    const result = await provider.analyzeImage({
      data: new Uint8Array(4),
      mimeType: 'image/jpeg',
    });

    expect(result.confident).toBe(true);
    expect(result.foods[0]!.name).toBe('Chicken Curry');
    expect(result.foods[0]!.confidence).toBe(0.82);
    expect(result.foods[0]!.rawLabel).toBe('chicken_curry');
    // Portions never come from this model.
    expect(result.foods[0]!.portionSource).toBe('category_default');
  });

  it('marks a low-confidence result as not confident', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json([{ label: 'apple_pie', score: 0.11 }])),
    );

    const provider = new HuggingFaceFoodProvider();
    const result = await provider.analyzeImage({
      data: new Uint8Array(4),
      mimeType: 'image/jpeg',
    });

    expect(result.confident).toBe(false);
    expect(result.notes).toContain('could not be identified confidently');
  });

  it('unwraps a doubly-nested response array', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json([[{ label: 'sushi', score: 0.9 }]])),
    );

    const provider = new HuggingFaceFoodProvider();
    const result = await provider.analyzeImage({
      data: new Uint8Array(4),
      mimeType: 'image/jpeg',
    });

    expect(result.foods[0]!.name).toBe('Sushi');
  });

  it('rejects a response that is not a classification list', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'nope' })),
    );

    const provider = new HuggingFaceFoodProvider();
    await expect(
      provider.analyzeImage({ data: new Uint8Array(4), mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('handles an empty prediction list without throwing', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])));

    const provider = new HuggingFaceFoodProvider();
    const result = await provider.analyzeImage({
      data: new Uint8Array(4),
      mimeType: 'image/jpeg',
    });

    expect(result.foods).toHaveLength(0);
    expect(result.confident).toBe(false);
  });

  it('surfaces a network failure as unavailable, not a raw error', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const provider = new HuggingFaceFoodProvider();
    const error = await provider
      .analyzeImage({ data: new Uint8Array(4), mimeType: 'image/jpeg' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(VisionError);
    // The upstream message must not leak through to the caller.
    expect((error as VisionError).message).not.toContain('ECONNREFUSED');
  });

  it('sends the token in a header and never in the URL', async () => {
    process.env.HF_TOKEN = 'secret-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json([{ label: 'pizza', score: 0.9 }]));
    vi.stubGlobal('fetch', fetchMock);

    await new HuggingFaceFoodProvider().analyzeImage({
      data: new Uint8Array(4),
      mimeType: 'image/jpeg',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('secret-token');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-token',
    );
  });
});

describe('confidence threshold', () => {
  it('is a sane guard rail', () => {
    expect(CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLD).toBeLessThan(1);
  });
});
