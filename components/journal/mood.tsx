import { CloudRain, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';
import type { JournalMood } from '@/types/journal';
import { JOURNAL_MOODS, JOURNAL_MOOD_LABELS } from '@/types/journal';
import { cn } from '@/lib/utils';

/**
 * Everything a mood looks like, in one place.
 *
 * Class strings are written out in full rather than composed from the mood
 * name — Tailwind scans source text, so `bg-mood-${mood}/15` would never be
 * generated. Each mood carries a glyph as well as a colour so the scale is
 * readable without relying on hue.
 */
interface MoodMeta {
  icon: LucideIcon;
  label: string;
  /** Foreground colour for the glyph and label. */
  text: string;
  /** Soft tinted fill behind the glyph. */
  tint: string;
  /** Full-strength fill, for the selected state and the mood bars. */
  solid: string;
  /** Border used when the mood is the selected option. */
  border: string;
}

export const MOOD_META: Record<JournalMood, MoodMeta> = {
  great: {
    icon: Laugh,
    label: JOURNAL_MOOD_LABELS.great,
    text: 'text-mood-great',
    tint: 'bg-mood-great/15',
    solid: 'bg-mood-great',
    border: 'border-mood-great',
  },
  good: {
    icon: Smile,
    label: JOURNAL_MOOD_LABELS.good,
    text: 'text-mood-good',
    tint: 'bg-mood-good/15',
    solid: 'bg-mood-good',
    border: 'border-mood-good',
  },
  okay: {
    icon: Meh,
    label: JOURNAL_MOOD_LABELS.okay,
    text: 'text-mood-okay',
    tint: 'bg-mood-okay/15',
    solid: 'bg-mood-okay',
    border: 'border-mood-okay',
  },
  low: {
    icon: Frown,
    label: JOURNAL_MOOD_LABELS.low,
    text: 'text-mood-low',
    tint: 'bg-mood-low/15',
    solid: 'bg-mood-low',
    border: 'border-mood-low',
  },
  rough: {
    icon: CloudRain,
    label: JOURNAL_MOOD_LABELS.rough,
    text: 'text-mood-rough',
    tint: 'bg-mood-rough/15',
    solid: 'bg-mood-rough',
    border: 'border-mood-rough',
  },
};

/** Glyph plus label — the journal's counterpart to MealIcon, used in the list. */
export function MoodChip({
  mood,
  className,
}: {
  mood: JournalMood;
  className?: string;
}) {
  const meta = MOOD_META[mood];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        meta.tint,
        meta.text,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * The mood scale as a row of buttons.
 *
 * Tapping the selected mood clears it — a mood chosen by mistake has to be
 * removable, and there is no other affordance for "actually, no mood".
 */
export function MoodPicker({
  value,
  onChange,
  className,
}: {
  value: JournalMood | null;
  onChange: (mood: JournalMood | null) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-5 gap-2', className)}>
      {JOURNAL_MOODS.map((mood) => {
        const meta = MOOD_META[mood];
        const Icon = meta.icon;
        const selected = value === mood;

        return (
          <button
            key={mood}
            type="button"
            onClick={() => onChange(selected ? null : mood)}
            aria-pressed={selected}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-all',
              selected
                ? cn(meta.border, meta.tint, meta.text, 'scale-[1.03]')
                : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
