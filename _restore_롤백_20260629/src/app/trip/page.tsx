import { redirect } from "next/navigation";
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

  const tripData = trips.map((t) => ({
    id: t.id,
    title: t.title,
    distanceM: t.distanceM,
    durationSec: t.durationSec,
    region: t.region,
    createdAt: t.startedAt.toISOString(),
    routePoints: t.routePoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    catches: t.fishingPoints.map((f) => ({
      id: f.id,
      speciesName: f.speciesName,
      sizeCm: f.sizeCm,
      photoUrl: f.photoUrl,
      region: f.region,
      gearSetup: f.gearSetup,
      createdAt: f.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="pb-10">
      <PageHeader title="내 낚시 기록" sub={`${trips.length}회 출조`} />
      {tripData.length === 0 ? (
        <EmptyState title="낚시 기록이 없습니다" desc="지도에서 '기록 시작'으로 동선을 기록해보세요" />
      ) : (
        <TripCards trips={tripData} />
      )}
    </div>
  );
}
