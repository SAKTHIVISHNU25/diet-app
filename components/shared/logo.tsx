import { cn } from '@/lib/utils';

/**
 * The MyLyf mark — a stylised lily, drawn as three large tepals with three
 * smaller inner petals between them, the way a real lily sits when viewed
 * head-on.
 *
 * It is pure geometry with `fill="currentColor"`, so it inherits colour from
 * whatever it sits in and stays legible down to 16px. The PWA icon PNGs are
 * generated from the same paths — see scripts/generate-icons.mjs.
 */
export function MyLyfMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <g fill="currentColor">
        {/* Three outer tepals, held back so the inner petals read first. */}
        <g opacity="0.55">
          <path d="M12 12.6C9.1 9.9 9.1 5.6 12 2.6c2.9 3 2.9 7.3 0 10Z" />
          <path
            d="M12 12.6C9.1 9.9 9.1 5.6 12 2.6c2.9 3 2.9 7.3 0 10Z"
            transform="rotate(120 12 12)"
          />
          <path
            d="M12 12.6C9.1 9.9 9.1 5.6 12 2.6c2.9 3 2.9 7.3 0 10Z"
            transform="rotate(240 12 12)"
          />
        </g>

        {/* Three inner petals, offset by 60°. */}
        <path
          d="M12 12.4c-2.1-2-2.1-5.1 0-7.2 2.1 2.1 2.1 5.2 0 7.2Z"
          transform="rotate(60 12 12)"
        />
        <path
          d="M12 12.4c-2.1-2-2.1-5.1 0-7.2 2.1 2.1 2.1 5.2 0 7.2Z"
          transform="rotate(180 12 12)"
        />
        <path
          d="M12 12.4c-2.1-2-2.1-5.1 0-7.2 2.1 2.1 2.1 5.2 0 7.2Z"
          transform="rotate(300 12 12)"
        />

        <circle cx="12" cy="12" r="1.85" />
      </g>
    </svg>
  );
}

/** The brand line. Keep it identical everywhere it appears. */
export const MYLYF_TAGLINE = 'Your life. Your wellbeing. One place.';

/**
 * Mark in a rounded tile, followed by the wordmark. Used in the landing and
 * auth headers.
 */
export function MyLyfLogo({
  className,
  tagline,
}: {
  className?: string;
  /** Show the brand line beneath the wordmark. */
  tagline?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground',
          tagline ? 'size-11' : 'size-9',
        )}
      >
        <MyLyfMark className={tagline ? 'size-7' : 'size-6'} />
      </span>

      <span className="flex flex-col">
        <MyLyfWordmark className={tagline ? 'leading-tight' : undefined} />
        {tagline ? (
          <span className="text-xs text-muted-foreground">{MYLYF_TAGLINE}</span>
        ) : null}
      </span>
    </span>
  );
}

export function MyLyfWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight', className)}>
      My<span className="text-primary">Lyf</span>
    </span>
  );
}
