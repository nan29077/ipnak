import { Skeleton } from "@/components/ui";

function ReservationCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </article>
  );
}

export default function ReservationsLoading() {
  return (
    <div className="animate-fadein">
      <div className="flex h-14 items-center px-3">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-3 md:px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ReservationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
