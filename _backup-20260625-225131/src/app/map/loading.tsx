import { Skeleton } from "@/components/ui";

export default function MapLoading() {
  return (
    <div className="animate-fadein relative h-[calc(100vh-5.5rem)] w-full overflow-hidden md:h-screen">
      {/* 지도 영역 플레이스홀더 */}
      <Skeleton className="h-full w-full rounded-none" />

      {/* 상단 검색 바 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>

      {/* 우측 플로팅 컨트롤 */}
      <div className="pointer-events-none absolute right-3 top-20 flex flex-col gap-2">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>

      {/* 하단 정보 카드 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3">
        <div className="card flex items-center gap-3 p-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
