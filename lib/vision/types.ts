/**
 * Types for the food vision layer.
 *
 * Nothing outside lib/vision/ should import a provider directly — depend on
 * these types and on getFoodVisionProvider() so the provider can be swapped.
 */

export interface ImageInput {
  /** Raw image bytes. */
  data: Uint8Array;
  /** MIME type, already validated by the caller. */
  mimeType: string;
}

export interface RecognizedFood {
  /** Human-readable food name, e.g. "Chicken Curry". */
  name: string;
  /** Model confidence, 0–1. */
  confidence: number;
  /** Count of pieces/items, if applicable (e.g. 2 for 2 eggs). */
  quantity?: number;
  /**
   * Free-text portion description, when the provider supports it.
   * The Food-101 classifier does NOT — see docs/FOOD_RECOGNITION.md.
   */
  estimatedPortion?: string;
  /**
   * Suggested portion in grams. For classification-only providers this is a
   * category default, not a measurement taken from the image. `portionSource`
   * records which it is.
   */
  estimatedGrams?: number;
  portionSource?: 'model' | 'category_default';
  /** Raw label as returned by the model, kept for debugging. */
  rawLabel?: string;
}

export interface FoodAnalysis {
  foods: RecognizedFood[];
  /** Human-readable note shown in the UI, e.g. a low-confidence warning. */
  notes?: string;
  /**
   * False when nothing cleared the confidence threshold. The UI must then ask
   * the user to choose the food manually.
   */
  confident: boolean;
  /** Which provider produced this result. */
  provider: string;
  /** Model identifier, when the provider exposes one. */
  model?: string;
}

/** Errors a provider is expected to raise, so routes can map them to responses. */
export type VisionErrorKind =
  | 'not_configured'
  /** Credentials exist but are not authorised for inference. */
  | 'insufficient_permissions'
  | 'unavailable'
  | 'timeout'
  | 'invalid_image'
  | 'invalid_response'
  | 'rate_limited'
  | 'model_loading';

export class VisionError extends Error {
  constructor(
    message: string,
    readonly kind: VisionErrorKind,
  ) {
    super(message);
    this.name = 'VisionError';
  }
}

export interface FoodVisionProvider {
  /** Stable provider name, used in logs and in the analyze response. */
  readonly name: string;
  analyzeImage(input: ImageInput): Promise<FoodAnalysis>;
}

/**
 * Below this confidence we do not present the result as an identification.
 * Food-101 classifiers are confidently wrong on out-of-distribution images
 * (the model always returns its best of 101 classes, even for a photo of a
 * car), so this threshold is a guard rail rather than a fine-tuned value.
 */
export const CONFIDENCE_THRESHOLD = 0.4;

/** Maximum image size accepted for analysis. Mirrors lib/validations/food.ts. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
