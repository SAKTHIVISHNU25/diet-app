import {
  Cookie,
  Moon,
  Sun,
  Sunrise,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { MealType } from '@/types/meal';
import { cn } from '@/lib/utils';

/** One glyph per meal, so a row is recognisable before the label is read. */
export const MEAL_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  snack: Cookie,
  dinner: Moon,
  other: UtensilsCrossed,
};

/**
 * Rounded tile carrying the meal glyph. Shared by the dashboard and history so
 * the same meal reads the same way in both places.
 */
export function MealIcon({
  mealType,
  muted,
  className,
}: {
  mealType: MealType;
  muted?: boolean;
  className?: string;
}) {
  const Icon = MEAL_ICONS[mealType];

  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        muted ? 'bg-muted text-muted-foreground' : 'bg-accent text-primary',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
