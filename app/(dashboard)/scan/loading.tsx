import { PageSkeleton, SkeletonCard } from '@/components/shared/page-skeleton';

export default function ScanLoading() {
  return (
    <PageSkeleton lines={2}>
      {/* The capture surface and its two source buttons. */}
      <SkeletonCard className="mt-6 h-64" />
      <SkeletonCard className="mt-4 h-12" />
    </PageSkeleton>
  );
}
