import { Skeleton } from "@/components/ui";

export default function MeLoading() {
  return (
    <div className="animate-fadein">
      {/* 프로필 헤더 */}
      <div className="px-3 pt-6 md:px-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>

        {/* 통계 행 */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-navy-50/60 py-3">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-4 h-11 w-full rounded-xl" />
      </div>

      {/* 리스트 */}
      <div className="mt-5 space-y-2 px-3 md:px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
