import { PageSkeleton, SkeletonCard, SkeletonCardList } from '@/components/shared/page-skeleton';

export default function ProgressLoading() {
  return (
    <PageSkeleton>
      {/* Summary tiles, the weight chart, then the weigh-in list. */}
      <SkeletonCard className="mt-6 h-24" />
      <SkeletonCard className="mt-4 h-64" />
      <SkeletonCardList className="mt-4" count={3} height="h-20" />
    </PageSkeleton>
  );
}
