import 'server-only';

import { clampPortion, suggestPortion } from './portions';
import {
  VisionError,
  type FoodAnalysis,
  type FoodVisionProvider,
  type ImageInput,
  type RecognizedFood,
} from './types';

/**
 * Hugging Face VLM provider.
 *
 * Uses Qwen2.5-VL-3B-Instruct (or similar VLM) via the OpenAI-compatible
 * Chat Completions API to recognize multiple foods and estimate portions.
 */

const DEFAULT_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct:featherless-ai';

const DEFAULT_INFERENCE_URL = 'https://router.huggingface.co/v1/chat/completions';

const REQUEST_TIMEOUT_MS = 30_000;

export class HuggingFaceFoodProvider implements FoodVisionProvider {
  readonly name = 'huggingface';

  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    this.model = process.env.HF_FOOD_MODEL || DEFAULT_MODEL;
    this.baseUrl = (process.env.HF_INFERENCE_URL || DEFAULT_INFERENCE_URL).replace(
      /\/$/,
      '',
    );
  }

  async analyzeImage(input: ImageInput): Promise<FoodAnalysis> {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new VisionError(
        'HF_TOKEN is not set',
        'not_configured',
      );
    }

    const raw = await this.callModel(input, token);
    return this.toAnalysis(raw);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async callModel(
    input: ImageInput,
    token: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const base64Image = Buffer.from(input.data).toString('base64');
      const dataUrl = `data:${input.mimeType};base64,${base64Image}`;

      const PROMPT = `Identify EVERY distinct food item visible in this image.

For each food give:
- "name": common descriptive name (e.g. "boiled egg", "pomegranate", "boiled sweet potato")
- "quantity": count/number of pieces (e.g., 2 for two eggs, 1 for a bowl of seeds)
- "portion_g": total estimated edible weight in grams for all pieces combined
- "confidence": 0.0 to 1.0

Return ONLY a valid JSON object in this exact format:
{"foods":[{"name":"...","quantity":1,"portion_g":0,"confidence":0.0}]}
`;

      const payload = {
        model: this.model,
        temperature: 0.1,
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: PROMPT }
            ]
          }
        ]
      };

      const endpoint = this.baseUrl.includes('v1') 
        ? this.baseUrl 
        : `${this.baseUrl}/${this.model}/v1/chat/completions`;

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        const detail = await response.text().catch(() => '');
        const insufficientPermissions =
          response.status === 403 || /permission/i.test(detail);

        console.error(
          `[vision:hf] ${response.status} from ${this.model}: ${detail.slice(0, 300)}`,
        );

        throw new VisionError(
          insufficientPermissions
            ? 'Hugging Face token lacks inference permission'
            : 'Hugging Face rejected the token',
          insufficientPermissions ? 'insufficient_permissions' : 'not_configured',
        );
      }
      if (response.status === 429) {
        throw new VisionError('Hugging Face rate limit reached', 'rate_limited');
      }
      if (response.status === 503) {
        throw new VisionError('The model is starting up', 'model_loading');
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`[vision:hf] error ${response.status}: ${detail}`);
        throw new VisionError(
          `Hugging Face responded with ${response.status}`,
          'unavailable',
        );
      }

      const json = await response.json();
      return json;
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

  private toAnalysis(responseJson: unknown): FoodAnalysis {
    try {
      const resp = responseJson as { choices?: { message?: { content?: string } }[] };
      const content = resp.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      console.log('[vision:hf] Raw content from VLM:\n', content);

      let parsed: any = null;
      const attempts = [content.trim()];
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) attempts.push(fenced[1].trim());
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        attempts.push(content.slice(firstBrace, lastBrace + 1));
      }

      for (const attempt of attempts) {
        try {
          parsed = JSON.parse(attempt);
          break;
        } catch {}
      }

      if (!parsed || !parsed.foods || !Array.isArray(parsed.foods)) {
         return {
           foods: [],
           confident: false,
           provider: this.name,
           model: this.model,
           notes: 'Model returned an unexpected response. Please select or enter the food manually.',
         };
      }

      const foods: RecognizedFood[] = parsed.foods
        .filter((f: { name?: string }) => f.name && f.name.toLowerCase().trim() !== 'unknown')
        .map((f: { name?: string, confidence?: number, portion_g?: number, quantity?: number }) => {
          const name = f.name || 'Unknown';
          const quantity = typeof f.quantity === 'number' && f.quantity > 0 ? f.quantity : 1;
          const hasModelPortion = typeof f.portion_g === 'number' && f.portion_g > 0;

          // The model's weight is a visual guess with no scale reference, and
          // every macro is derived from it. Bound it to what this food can
          // plausibly weigh for the number of pieces reported.
          const portion = hasModelPortion
            ? clampPortion(name, f.portion_g!, quantity)
            : { grams: suggestPortion(name).grams * quantity, clamped: false };

          return {
            name,
            confidence: typeof f.confidence === 'number' ? f.confidence : 0,
            quantity,
            estimatedGrams: portion.grams,
            estimatedPortion: portion.clamped
              ? 'adjusted to a realistic serving size'
              : undefined,
            portionSource: (hasModelPortion ? 'model' : 'category_default') as
              | 'model'
              | 'category_default',
          };
        });

      const confident = foods.some(f => f.confidence >= 0.4);

      return {
        foods,
        confident,
        provider: this.name,
        model: this.model,
        notes: confident
          ? 'Portion is estimated from the photo by the model. Adjust it if needed.'
          : 'Food could not be identified confidently. Please select or enter the food manually.',
      };

    } catch (err) {
      console.error('[vision:hf] Failed to parse model output:', responseJson, err);
      return {
        foods: [],
        confident: false,
        provider: this.name,
        model: this.model,
        notes: 'Failed to process model output.',
      };
    }
  }
}
