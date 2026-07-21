import { Skeleton } from "@/components/ui";

function PostCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex items-center gap-4 px-3 py-3">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="space-y-2 px-3 pb-4">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </article>
  );
}

export default function FeedLoading() {
  return (
    <div className="animate-fadein">
      <div className="sticky top-12 z-10 flex h-14 items-center justify-between border-b border-navy-100 bg-[#161616]/80 px-3 backdrop-blur-md">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="space-y-3 px-3 py-3 md:px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
