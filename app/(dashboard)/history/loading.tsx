import { PageSkeleton, SkeletonCard, SkeletonCardList } from '@/components/shared/page-skeleton';

export default function HistoryLoading() {
  return (
    <PageSkeleton>
      {/* The 30-day summary strip, then one card per logged day. */}
      <SkeletonCard className="mt-6 h-24" />
      <SkeletonCardList className="mt-4" count={4} height="h-48" />
    </PageSkeleton>
  );
}
