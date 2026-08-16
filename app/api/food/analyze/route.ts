import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleUnexpected } from '@/lib/utils/api';
import { requireUser } from '@/lib/utils/route-auth';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/validations/food';
import { describeVisionError, recognizeFood } from '@/lib/vision/food-recognition';
import { VisionError } from '@/lib/vision/types';

/**
 * POST /api/food/analyze
 *
 * Body: multipart/form-data with an `image` file.
 * Returns recognition candidates enriched with nutrition. Nothing is logged —
 * the client shows the result for confirmation first.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError('invalid_request', 'Expected an image upload.');
    }

    const file = formData.get('image');

    if (!(file instanceof File) || file.size === 0) {
      return apiError('invalid_image', 'Please choose an image to analyze.');
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return apiError(
        'image_too_large',
        `That image is too large. Please use one under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
      );
    }

    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return apiError('invalid_image', 'Please upload a JPEG, PNG or WebP image.');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Verify the bytes actually look like the declared image type. A client can
    // set any MIME type it likes, so the header check is what we trust.
    if (!hasImageMagicBytes(bytes)) {
      return apiError('invalid_image', 'That file does not look like a valid image.');
    }

    const result = await recognizeFood({ data: bytes, mimeType: file.type });

    return apiSuccess({
      candidates: result.candidates,
      alternatives: result.alternatives,
      confident: result.analysis.confident,
      notes: result.analysis.notes,
      provider: result.analysis.provider,
      model: result.analysis.model,
      nutritionDegraded: result.nutritionDegraded,
    });
  } catch (error) {
    if (error instanceof VisionError) {
      const { code, message } = describeVisionError(error);
      console.warn(`[api:food/analyze] vision ${error.kind}`);
      return apiError(code, message);
    }
    return handleUnexpected('food/analyze', error);
  }
}

/** Checks the leading bytes against the JPEG / PNG / WebP signatures. */
function hasImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return true;

  // WebP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return true;
  }

  return false;
}
