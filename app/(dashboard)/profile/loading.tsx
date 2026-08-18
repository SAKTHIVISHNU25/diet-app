import { PageSkeleton, SkeletonCardList } from '@/components/shared/page-skeleton';

export default function ProfileLoading() {
  return (
    <PageSkeleton>
      <SkeletonCardList className="mt-6" count={4} height="h-36" />
    </PageSkeleton>
  );
}
