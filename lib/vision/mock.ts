import { suggestPortion } from './portions';
import type { FoodAnalysis, FoodVisionProvider, ImageInput } from './types';

/**
 * Deterministic provider for local development and tests.
 *
 * Makes no network calls and needs no credentials. The result is derived from
 * the image byte length so the same image always yields the same food — which
 * keeps tests stable.
 *
 * Enable with FOOD_VISION_PROVIDER=mock.
 */

const SAMPLE_FOODS = [
  'grilled_salmon',
  'caesar_salad',
  'chicken_curry',
  'fried_rice',
  'omelette',
  'pizza',
] as const;

export class MockFoodProvider implements FoodVisionProvider {
  readonly name = 'mock';

  async analyzeImage(input: ImageInput): Promise<FoodAnalysis> {
    const index = input.data.length % SAMPLE_FOODS.length;
    const label = SAMPLE_FOODS[index]!;
    const portion = suggestPortion(label);

    // A slice of the byte length gives a stable pseudo-confidence in 0.55–0.95.
    const confidence = 0.55 + ((input.data.length % 41) / 100);

    return {
      foods: [
        {
          name: label
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          confidence: Math.round(confidence * 1000) / 1000,
          estimatedGrams: portion.grams,
          estimatedPortion: portion.label,
          portionSource: 'category_default',
          rawLabel: label,
        },
      ],
      confident: true,
      provider: this.name,
      model: 'mock-food-classifier',
      notes:
        'Mock provider — this result is generated locally and is not a real identification.',
    };
  }
}
