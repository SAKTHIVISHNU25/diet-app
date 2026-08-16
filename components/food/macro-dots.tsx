import { cn, formatNumber } from '@/lib/utils';

/**
 * Protein / carbs / fat in grams, as three colour-coded chips.
 *
 * The colours match the macro bars on the dashboard, and each one keeps its
 * letter label — the dot is a reinforcement, never the only signal.
 */
export function MacroDots({
  protein,
  carbs,
  fat,
  className,
}: {
  protein: number;
  carbs: number;
  fat: number;
  className?: string;
}) {
  const items = [
    { label: 'P', name: 'Protein', value: protein, dot: 'bg-protein' },
    { label: 'C', name: 'Carbs', value: carbs, dot: 'bg-carbs' },
    { label: 'F', name: 'Fat', value: fat, dot: 'bg-fat' },
  ];

  return (
    <span
      className={cn(
        'tabular inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          <span className={cn('size-1.5 rounded-full', item.dot)} aria-hidden />
          <span className="sr-only">{item.name} </span>
          <span aria-hidden>{item.label} </span>
          {formatNumber(item.value, 1)} g
        </span>
      ))}
    </span>
  );
}
