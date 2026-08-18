import { PageSkeleton, SkeletonCard, SkeletonCardList } from '@/components/shared/page-skeleton';

export default function JournalLoading() {
  return (
    <PageSkeleton>
      {/* Quote, streak summary, the write box, then past entries. */}
      <SkeletonCard className="mt-6 h-20" />
      <SkeletonCard className="mt-4 h-24" />
      <SkeletonCard className="mt-4 h-40" />
      <SkeletonCardList className="mt-4" count={3} height="h-28" />
    </PageSkeleton>
  );
}
