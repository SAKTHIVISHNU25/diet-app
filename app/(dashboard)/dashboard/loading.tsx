import {
  PageSkeleton,
  SkeletonCard,
  SkeletonCardList,
} from '@/components/shared/page-skeleton';

export default function DashboardLoading() {
  return (
    <PageSkeleton>
      {/* Calorie ring, then macros, then the meal sections. */}
      <SkeletonCard className="mt-6 h-56" />
      <SkeletonCard className="mt-4 h-28" />
      <SkeletonCard className="mt-4 h-24" />
      <SkeletonCardList className="mt-4" count={3} height="h-24" />
    </PageSkeleton>
  );
}
