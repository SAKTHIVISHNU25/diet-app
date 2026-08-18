import { PageSkeleton, SkeletonCard, SkeletonCardList } from '@/components/shared/page-skeleton';

export default function DietPlanLoading() {
  return (
    <PageSkeleton lines={2}>
      {/* Day selector, then the meals for the selected day. */}
      <SkeletonCard className="mt-6 h-12" />
      <SkeletonCardList className="mt-4" count={4} height="h-28" />
    </PageSkeleton>
  );
}
