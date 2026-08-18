import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The placeholder every dashboard route paints while its server data loads.
 *
 * Each page is `force-dynamic`, so navigating to one means waiting on a
 * session verify plus a database read. Without a loading boundary the router
 * holds the *previous* page on screen for that whole time and the tap feels
 * dead. These skeletons are what `loading.tsx` renders instead — they also let
 * Next prefetch the route shell, so the shell is already in the client when
 * the tap happens.
 *
 * The shape deliberately mirrors the real page (same header block, same card
 * rhythm) so the swap to real content does not jump.
 */
export function PageSkeleton({
  /** Two lines of description text, as most pages have. */
  lines = 1,
  children,
}: {
  lines?: number;
  children?: React.ReactNode;
}) {
  return (
    <main className="px-5 py-6">
      <header>
        <Skeleton className="h-8 w-44" />
        <div className="mt-2.5 space-y-1.5">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton
              key={index}
              className={cn('h-3.5', index === lines - 1 ? 'w-1/2' : 'w-4/5')}
            />
          ))}
        </div>
      </header>

      {children}
    </main>
  );
}

/** A card-shaped block, sized by `className` (e.g. `h-40`). */
export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn('w-full rounded-2xl', className)} />;
}

/** `count` stacked cards of the same height — the common list placeholder. */
export function SkeletonCardList({
  count = 3,
  height = 'h-32',
  className,
}: {
  count?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} className={height} />
      ))}
    </div>
  );
}
