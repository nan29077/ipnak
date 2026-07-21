import Link from "next/link";
import { redirect } from "next/navigation";
import { Fish, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { TripCards } from "@/components/TripCards";

export const dynamic = "force-dynamic";

export default async function TripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trips = await prisma.fishingTrip.findMany({
    where: { userId: user.id },
    include: {
      routePoints: { orderBy: { order: "asc" } },
      fishingPoints: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  });

  // tripId 없이 기록된 기존 피쉬 데이터 보완 — 세션 시간 범위 내 FishingPoint 조회
  const allFallbackPoints = trips.some((t) => t.fishingPoints.length === 0)
    ? await prisma.fishingPoint.findMany({
        where: { userId: user.id, tripId: null },
        orderBy: { createdAt: "asc" },
      }).catch(() => [] as any[])
    : [] as any[];

  const tripData = trips.map((t) => {
    let catches = t.fishingPoints as any[];
    // 연결된 피쉬 기록이 없으면 세션 시간 범위로 fallback
    if (catches.length === 0 && allFallbackPoints.length > 0) {
      const sessionEnd = t.endedAt ?? new Date(t.startedAt.getTime() + t.durationSec * 1000 + 60000);
      catches = allFallbackPoints.filter((f: any) => f.createdAt >= t.startedAt && f.createdAt <= sessionEnd);
    }
    return {
      id: t.id,
      title: t.title,
      distanceM: t.distanceM,
      durationSec: t.durationSec,
      region: t.region,
      catchCount: t.catchCount,
      createdAt: t.startedAt.toISOString(),
      routePoints: t.routePoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      catches: catches.map((f: any) => ({
        id: f.id,
        speciesName: f.speciesName,
        sizeCm: f.sizeCm,
        photoUrl: f.photoUrl,
        region: f.region,
        gearSetup: f.gearSetup,
        createdAt: f.createdAt.toISOString(),
        lat: f.lat,
        lng: f.lng,
      })),
    };
  });

  return (
    <div className="pb-10">
      <PageHeader title="내 낚시 기록" sub={`${trips.length}회 출조`} right={
        <Link href="/catch" className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-700 transition-colors hover:bg-navy-100">
          <Fish size={14} className="text-aqua-500" /> 피쉬 기록 <ChevronRight size={13} />
        </Link>
      } />
      {tripData.length === 0 ? (
        <EmptyState title="낚시 기록이 없습니다" desc="지도에서 '기록 시작'으로 동선을 기록해보세요" />
      ) : (
        <TripCards trips={tripData} />
      )}
    </div>
  );
}
