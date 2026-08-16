import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MEDICAL_DISCLAIMER_TEXT =
  'Nutrition and calorie values are estimates and should not be considered medical advice. Consult a qualified healthcare professional for medical or dietary conditions.';

/**
 * Shown wherever calorie or nutrition numbers are presented as guidance —
 * the landing page, the dashboard, the diet plan and the scan review screen.
 */
export function MedicalDisclaimer({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
        {MEDICAL_DISCLAIMER_TEXT}
      </p>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{MEDICAL_DISCLAIMER_TEXT}</p>
    </div>
  );
}
