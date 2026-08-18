import 'server-only';

import type { FoodCandidate } from '@/types/food';
import { searchFood } from '@/lib/usda/search';
import { UsdaError } from '@/lib/usda/client';
import { getFoodVisionProvider } from './provider';
import {
  CONFIDENCE_THRESHOLD,
  VisionError,
  type FoodAnalysis,
  type ImageInput,
} from './types';

/**
 * Orchestrates the recognition pipeline:
 *
 *   image -> vision provider -> food identification -> USDA lookup
 *
 * The result is a list of *candidates*, not log entries. Nothing is written to
 * the food log here — the user reviews and confirms first.
 */

export interface RecognitionResult {
  analysis: FoodAnalysis;
  /** The top identification, enriched with nutrition. Empty when unconfident. */
  candidates: FoodCandidate[];
  /** Alternative labels the user can switch to, from the same prediction set. */
  alternatives: { name: string; confidence: number }[];
  /** Set when USDA could not be reached; the candidate needs manual nutrition. */
  nutritionDegraded: boolean;
}

export async function recognizeFood(input: ImageInput): Promise<RecognitionResult> {
  const provider = getFoodVisionProvider();
  const analysis = await provider.analyzeImage(input);

  const confidentFoods = analysis.foods.filter(
    (food) => food.confidence >= CONFIDENCE_THRESHOLD,
  );

  if (confidentFoods.length === 0 || !analysis.confident) {
    return {
      analysis,
      candidates: [],
      alternatives: analysis.foods.map((f) => ({
        name: f.name,
        confidence: f.confidence,
      })),
      nutritionDegraded: false,
    };
  }

  let nutritionDegraded = false;

  const candidates: FoodCandidate[] = await Promise.all(
    confidentFoods.map(async (food, index) => {
      const grams = food.estimatedGrams ?? 200;

      let candidate: FoodCandidate = {
        id: `candidate-${Date.now()}-${index}`,
        name: food.name,
        quantity: food.quantity ?? 1,
        grams,
        confidence: food.confidence,
        estimatedPortion: food.estimatedPortion,
        nutrition: null,
        source: 'estimate',
        needsNutrition: true,
      };

      try {
        const { items } = await searchFood(food.name, 1);
        const match = items[0];

        if (match) {
          candidate = {
            ...candidate,
            nutrition: {
              caloriesPer100g: match.caloriesPer100g,
              proteinPer100g: match.proteinPer100g,
              carbsPer100g: match.carbsPer100g,
              fatPer100g: match.fatPer100g,
            },
            // `match` is the first item, so it carries the search's own source.
            source: match.source,
            fdcId: match.fdcId,
            needsNutrition: false,
          };
        }
      } catch (error) {
        if (error instanceof UsdaError) {
          nutritionDegraded = true;
          console.warn(`[vision:recognize] USDA lookup failed for ${food.name}: ${error.kind}`);
        } else {
          throw error;
        }
      }

      return candidate;
    }),
  );

  return {
    analysis,
    candidates,
    alternatives: [],
    nutritionDegraded,
  };
}

/** Maps a VisionError to the API error code and user-facing message. */
export function describeVisionError(error: VisionError): {
  code:
    | 'not_configured'
    | 'provider_unavailable'
    | 'provider_timeout'
    | 'invalid_image'
    | 'rate_limited';
  message: string;
} {
  switch (error.kind) {
    case 'not_configured':
      return {
        code: 'not_configured',
        message: 'Food recognition is not configured. You can still add foods manually.',
      };
    case 'insufficient_permissions':
      return {
        code: 'not_configured',
        message:
          'The Hugging Face token is missing the "Make calls to Inference Providers" permission. Update it at huggingface.co/settings/tokens. You can still add foods manually.',
      };
    case 'timeout':
      return {
        code: 'provider_timeout',
        message:
          'Food recognition took too long. Please try again or add the food manually.',
      };
    case 'model_loading':
      return {
        code: 'provider_unavailable',
        message:
          'The recognition model is starting up. Please try again in a few seconds.',
      };
    case 'rate_limited':
      return {
        code: 'rate_limited',
        message:
          'Too many requests to the recognition service. Please try again shortly.',
      };
    case 'invalid_image':
      return { code: 'invalid_image', message: 'That image could not be read.' };
    case 'invalid_response':
    case 'unavailable':
    default:
      return {
        code: 'provider_unavailable',
        message:
          'Food recognition is unavailable right now. You can still add foods manually.',
      };
  }
}
