import { cn } from '@/lib/utils';

/**
 * The heading block every page opens with.
 *
 * Kept in one place so the title size, the description colour and the gap to
 * the content below stay identical from screen to screen.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Small line above the title — a date, a section name. */
  eyebrow?: React.ReactNode;
  /** Right-aligned control, e.g. a settings link. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
