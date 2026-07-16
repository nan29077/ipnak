import { Skeleton } from "@/components/ui";

function ProductCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </article>
  );
}

export default function ShopLoading() {
  return (
    <div className="animate-fadein">
      <div className="flex h-14 items-center px-3">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-3 md:grid-cols-3 md:px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
