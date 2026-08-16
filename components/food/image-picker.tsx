'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFileSize, ImageError, prepareImage } from '@/lib/utils/image';
import { ACCEPTED_IMAGE_TYPES } from '@/lib/validations/food';

interface ImagePickerProps {
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

const ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');

/**
 * Image input for the scan flow.
 *
 * Two separate inputs: one with `capture="environment"` which opens the rear
 * camera directly on mobile, and one without, which opens the gallery or file
 * browser. A single input cannot offer both on Android Chrome.
 *
 * Desktop additionally supports drag and drop.
 */
export function ImagePicker({ onSelect, onClear, disabled }: ImagePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ size: number; compressed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setPreparing(true);

      try {
        const prepared = await prepareImage(file);

        // Release the previous object URL before replacing it.
        setPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return prepared.previewUrl;
        });
        setMeta({ size: prepared.file.size, compressed: prepared.compressed });
        onSelect(prepared.file);
      } catch (caught) {
        setError(
          caught instanceof ImageError
            ? caught.message
            : 'That image could not be read. Please try another photo.',
        );
      } finally {
        setPreparing(false);
      }
    },
    [onSelect],
  );

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setMeta(null);
    setError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    onClear();
  };

  if (preview) {
    return (
      <div className="mt-6">
        <div className="relative overflow-hidden rounded-2xl border bg-muted">
          {/* Object URLs cannot go through the Next image optimizer. */}
          <Image
            src={preview}
            alt="The meal you selected"
            width={800}
            height={600}
            unoptimized
            className="h-64 w-full object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={clear}
            disabled={disabled}
            aria-label="Remove image"
            className="absolute right-3 top-3 shadow-md"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {meta ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {formatFileSize(meta.size)}
            {meta.compressed ? ' · resized for upload' : ''}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-accent/50' : 'border-input',
        )}
      >
        {preparing ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Preparing image…</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Take a photo of your meal, or choose an existing one.
            </p>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
              You can also drag an image here.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                size="lg"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled}
              >
                <Camera aria-hidden />
                Take photo
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => galleryInputRef.current?.click()}
                disabled={disabled}
              >
                <ImageIcon aria-hidden />
                Choose image
              </Button>
            </div>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* capture="environment" asks mobile browsers for the rear camera. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Take a photo of your meal"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose an image of your meal"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
