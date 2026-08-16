import 'server-only';

import { z } from 'zod';
import { suggestPortion } from './portions';
import {
  CONFIDENCE_THRESHOLD,
  VisionError,
  type FoodAnalysis,
  type FoodVisionProvider,
  type ImageInput,
  type RecognizedFood,
} from './types';

/**
 * Vision-Language Model provider.
 *
 * This is the accurate path, and the reason it exists: a Food-101 classifier
 * can only return one of 101 fixed labels, so it cannot see a plate with three
 * foods on it and cannot name anything outside its training set. A VLM is given
 * the image plus an instruction and answers in open vocabulary, so it can:
 *
 *   - name several distinct foods in one photo
 *   - name regional dishes that are absent from Food-101
 *   - say "unknown" instead of forcing a wrong label
 *   - offer a rough portion estimate
 *
 * Default model: Qwen/Qwen2.5-VL-7B-Instruct (Apache-2.0, open weights).
 *
 * Honest limits — see docs/LIMITATIONS.md:
 *   - Portion estimates are a language model's visual guess. Better than the
 *     category default the classifier path uses, but still not a measurement:
 *     no depth data, no reference object, no scale. Always user-editable.
 *   - Confidence is self-reported. A VLM's stated confidence is not calibrated
 *     the way a classifier's softmax is; treat it as a rough signal only.
 *   - It can hallucinate a plausible-but-absent food, which a classifier
 *     cannot. User confirmation stays mandatory for exactly this reason.
 */

const DEFAULT_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct:featherless-ai';
const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1/chat/completions';

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_FOODS = 10;

/**
 * The instruction. Two things matter most here:
 *   1. "Do not force" — the failure mode we are escaping is a model inventing
 *      a label because it must pick something.
 *   2. Names suited to a nutrition database, since the next step is a USDA
 *      lookup. "Boiled egg" resolves; "protein-rich breakfast" does not.
 */
const PROMPT = `Analyze this food photograph.

Identify EVERY distinct food item that is actually visible. Do not force an item into a category, and do not guess at foods you cannot see. If you cannot identify something, name it "unknown".

For each food give:
- "name": a common food name suitable for looking up in a nutrition database (e.g. "boiled egg", "pomegranate seeds", "boiled sweet potato", "chicken biryani"). Prefer plain descriptive names over brand or restaurant names.
- "portion_g": your best estimate of the edible weight in grams.
- "confidence": 0.0 to 1.0, how sure you are of the identification.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"foods":[{"name":"...","portion_g":0,"confidence":0.0}]}

If the image contains no food at all, respond with {"foods":[]}.`;

/** What we require back from the model. Anything else is rejected. */
const responseSchema = z.object({
  foods: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        portion_g: z.coerce.number().min(0).max(5000).optional(),
        confidence: z.coerce.number().min(0).max(1).optional(),
      }),
    )
    .max(50),
});

export class VlmFoodProvider implements FoodVisionProvider {
  readonly name = 'vlm';

  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    this.model = process.env.HF_VLM_MODEL || DEFAULT_MODEL;
    this.baseUrl = process.env.HF_VLM_URL || DEFAULT_BASE_URL;
  }

  async analyzeImage(input: ImageInput): Promise<FoodAnalysis> {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new VisionError('HF_TOKEN is not set', 'not_configured');
    }

    const content = await this.callModel(input, token);
    return this.toAnalysis(content);
  }

  private async callModel(input: ImageInput, token: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // The provider takes an image URL; a data URI carries the bytes inline,
    // which avoids having to host the photo anywhere.
    const dataUri = `data:${input.mimeType};base64,${Buffer.from(input.data).toString('base64')}`;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          // Low temperature: this is an extraction task, not a creative one.
          temperature: 0.1,
          max_tokens: 600,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: dataUri } },
              ],
            },
          ],
        }),
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        const detail = await response.text().catch(() => '');
        console.error(`[vision:vlm] ${response.status}: ${detail.slice(0, 300)}`);
        throw new VisionError(
          'The Hugging Face token is not authorised for inference',
          'insufficient_permissions',
        );
      }
      if (response.status === 429) {
        throw new VisionError('Inference rate limit reached', 'rate_limited');
      }
      if (response.status === 402) {
        // Third-party providers are metered; free credits can run out.
        const detail = await response.text().catch(() => '');
        console.error(`[vision:vlm] 402 payment required: ${detail.slice(0, 300)}`);
        throw new VisionError('Inference credits exhausted', 'rate_limited');
      }
      if (response.status === 503) {
        throw new VisionError('The model is starting up', 'model_loading');
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(
          `[vision:vlm] ${response.status} from ${this.model}: ${detail.slice(0, 300)}`,
        );
        throw new VisionError(
          `Inference provider responded with ${response.status}`,
          'unavailable',
        );
      }

      const json: unknown = await response.json();
      const text = extractMessageContent(json);

      if (!text) {
        throw new VisionError(
          'Vision model returned an empty response',
          'invalid_response',
        );
      }

      return text;
    } catch (error) {
      if (error instanceof VisionError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VisionError('The vision model timed out', 'timeout');
      }
      throw new VisionError('Could not reach the vision model', 'unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private toAnalysis(content: string): FoodAnalysis {
    const parsed = parseJsonLoosely(content);

    if (!parsed) {
      console.error(`[vision:vlm] unparseable content: ${content.slice(0, 300)}`);
      throw new VisionError(
        'Vision model did not return valid JSON',
        'invalid_response',
      );
    }

    const result = responseSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`[vision:vlm] schema mismatch: ${content.slice(0, 300)}`);
      throw new VisionError(
        'Vision model returned an unexpected shape',
        'invalid_response',
      );
    }

    const foods: RecognizedFood[] = result.data.foods
      // The prompt allows "unknown"; it is not something to look up.
      .filter((food) => food.name.toLowerCase().trim() !== 'unknown')
      .slice(0, MAX_FOODS)
      .map((food) => {
        const confidence = food.confidence ?? 0.5;

        // Trust the model's portion when it gave one, otherwise fall back to
        // the category table. Recording which it was keeps the UI honest.
        const hasModelPortion =
          typeof food.portion_g === 'number' && food.portion_g > 0;
        const fallback = suggestPortion(food.name);

        return {
          name: titleCase(food.name),
          confidence: round3(confidence),
          estimatedGrams: hasModelPortion ? Math.round(food.portion_g!) : fallback.grams,
          estimatedPortion: hasModelPortion
            ? 'estimated from the photo'
            : fallback.label,
          portionSource: (hasModelPortion ? 'model' : 'category_default') as 'model' | 'category_default',
          rawLabel: food.name,
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    if (foods.length === 0) {
      return {
        foods: [],
        confident: false,
        provider: this.name,
        model: this.model,
        notes:
          'No food could be identified in that photo. Please select or enter the food manually.',
      };
    }

    // Confident when at least one food clears the bar; the review screen shows
    // each food separately with its own confidence.
    const confident = foods.some((food) => food.confidence >= CONFIDENCE_THRESHOLD);

    return {
      foods,
      confident,
      provider: this.name,
      model: this.model,
      notes: confident
        ? 'Portions are estimated from the photo and are approximate. Check each one before saving.'
        : 'Food could not be identified confidently. Please select or enter the food manually.',
    };
  }
}

/** Pull the assistant message out of an OpenAI-shaped chat completion. */
function extractMessageContent(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: { content?: unknown } })?.message;
  const content = message?.content;

  if (typeof content === 'string') return content;

  // Some providers return content as an array of parts.
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join('');
    return text || null;
  }

  return null;
}

/**
 * Models often wrap JSON in prose or ```json fences despite being told not to.
 * Try the raw string, then any fenced block, then the outermost {...}.
 */
function parseJsonLoosely(content: string): unknown | null {
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
      return JSON.parse(attempt) as unknown;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
