import { Skeleton } from "@/components/ui";

function TripCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5 py-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-2/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function TripLoading() {
  return (
    <div className="animate-fadein">
      <div className="flex h-14 items-center px-3">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="space-y-3 px-3 py-3 md:px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
