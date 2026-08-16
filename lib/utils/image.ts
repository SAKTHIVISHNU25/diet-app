import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/validations/food';

/**
 * Client-side image preparation.
 *
 * Phone cameras produce 4–12 MB images, but the classifier resizes everything
 * to 224x224 anyway. Downscaling before upload saves the user's data and keeps
 * requests well inside the size limit, with no loss of recognition quality.
 */

/** Longest edge after downscaling. Generous relative to the model's 224px input. */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

export interface PreparedImage {
  file: File;
  previewUrl: string;
  /** True when the image was re-encoded rather than passed through as-is. */
  compressed: boolean;
}

export class ImageError extends Error {}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageError('Please choose a JPEG, PNG or WebP image.');
  }

  // Reject absurd files before decoding them — decoding a 200 MB image would
  // hang the tab.
  if (file.size > MAX_IMAGE_BYTES * 6) {
    throw new ImageError('That image is far too large. Please choose a smaller one.');
  }

  // Small files go through untouched; re-encoding would only lose quality.
  if (file.size <= 600 * 1024) {
    return { file, previewUrl: URL.createObjectURL(file), compressed: false };
  }

  try {
    const compressed = await downscale(file);
    return {
      file: compressed,
      previewUrl: URL.createObjectURL(compressed),
      compressed: true,
    };
  } catch {
    // Canvas can fail (memory, tainted image). Fall back to the original if it
    // is still inside the limit rather than blocking the scan entirely.
    if (file.size <= MAX_IMAGE_BYTES) {
      return { file, previewUrl: URL.createObjectURL(file), compressed: false };
    }
    throw new ImageError('That image could not be processed. Please try another photo.');
  }
}

async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });

  if (!blob) throw new Error('Canvas encoding failed');

  return new File([blob], replaceExtension(file.name, 'jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function replaceExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'meal';
  return `${base}.${extension}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
