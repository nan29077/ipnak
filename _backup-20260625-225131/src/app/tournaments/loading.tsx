import { Skeleton } from "@/components/ui";

function BannerCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <Skeleton className="aspect-[16/7] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </article>
  );
}

export default function TournamentsLoading() {
  return (
    <div className="animate-fadein">
      <div className="flex h-14 items-center px-3">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="space-y-3 px-3 py-3 md:px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <BannerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
