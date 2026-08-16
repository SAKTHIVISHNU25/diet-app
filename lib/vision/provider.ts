import { HuggingFaceFoodProvider } from './huggingface';
import { MockFoodProvider } from './mock';
import type { FoodVisionProvider } from './types';

export type { FoodVisionProvider } from './types';

/**
 * Provider registry.
 *
 * To add a provider (a local ONNX model, a multimodal detector, a hosted
 * endpoint): implement FoodVisionProvider, register it here, and set
 * FOOD_VISION_PROVIDER. No other file needs to change.
 */
const PROVIDERS: Record<string, () => FoodVisionProvider> = {
  huggingface: () => new HuggingFaceFoodProvider(),
  mock: () => new MockFoodProvider(),
};

export const AVAILABLE_PROVIDERS = Object.keys(PROVIDERS);

let cached: FoodVisionProvider | null = null;
let cachedKey: string | null = null;

/**
 * Resolve the configured provider. Falls back to `mock` when the value is
 * unrecognised, so a typo in the environment degrades to a working dev
 * experience instead of a crash — the fallback is logged.
 */
export function getFoodVisionProvider(): FoodVisionProvider {
  const key = (process.env.FOOD_VISION_PROVIDER || 'huggingface').toLowerCase();

  if (cached && cachedKey === key) return cached;

  const factory = PROVIDERS[key];

  if (!factory) {
    console.warn(
      `[vision] Unknown FOOD_VISION_PROVIDER "${key}". Falling back to "mock". Available: ${AVAILABLE_PROVIDERS.join(', ')}`,
    );
    cached = new MockFoodProvider();
    cachedKey = key;
    return cached;
  }

  cached = factory();
  cachedKey = key;
  return cached;
}

/** Test hook — clears the memoized provider between environment changes. */
export function resetFoodVisionProvider(): void {
  cached = null;
  cachedKey = null;
}
