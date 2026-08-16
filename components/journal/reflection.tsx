import { CircleAlert, CircleCheck, Target, type LucideIcon } from 'lucide-react';
import type { ReflectionField } from '@/types/journal';
import { REFLECTION_LABELS } from '@/types/journal';

/**
 * How each part of the daily review looks and what it asks for.
 *
 * The three borrow the mood palette rather than inventing a fourth set of
 * colours — went-well reads as the good end of the scale, went-wrong as the
 * rough end, and what-to-improve as the app's own primary, because it is the
 * part that turns into an action.
 */
interface ReflectionMeta {
  icon: LucideIcon;
  label: string;
  placeholder: string;
  text: string;
  tint: string;
}

export const REFLECTION_META: Record<ReflectionField, ReflectionMeta> = {
  went_well: {
    icon: CircleCheck,
    label: REFLECTION_LABELS.went_well,
    placeholder: 'Hit my protein target, walked after dinner.',
    text: 'text-mood-great',
    tint: 'bg-mood-great/15',
  },
  went_wrong: {
    icon: CircleAlert,
    label: REFLECTION_LABELS.went_wrong,
    placeholder: 'Skipped lunch, then over-ate at 9pm.',
    text: 'text-mood-rough',
    tint: 'bg-mood-rough/15',
  },
  to_improve: {
    icon: Target,
    label: REFLECTION_LABELS.to_improve,
    placeholder: 'Prep lunch the night before.',
    text: 'text-primary',
    tint: 'bg-primary/10',
  },
};
