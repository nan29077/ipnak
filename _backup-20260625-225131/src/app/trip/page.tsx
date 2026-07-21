import { redirect } from "next/navigation";
import { Navigation, Clock, Fish, MapPin } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, Card, Badge } from "@/components/ui";
import { MiniRoute } from "@/components/MiniRoute";
import { km, duration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trips = await prisma.fishingTrip.findMany({
    where: { userId: user.id },
    include: { routePoints: { orderBy: { order: "asc" } }, fishingPoints: true },
    orderBy: { startedAt: "desc" },
  });

  return (
    <div className="pb-10">
      <PageHeader title="내 낚시 기록" sub={`${trips.length}회 출조`} />
      {trips.length === 0 ? (
        <EmptyState title="낚시 기록이 없습니다" desc="지도에서 '피싱 시작하기'로 동선을 기록해보세요" />
      ) : (
        <div className="space-y-3 p-4">
          {trips.map((t) => (
            <Card key={t.id} className="flex gap-3 p-3">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-navy-100">
                <MiniRoute points={t.routePoints} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-navy-800">{t.title || `${t.region} 출조`}</p>
                  <span className="shrink-0 text-[11px] text-navy-300">{format(t.startedAt, "M.d")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="aqua"><Navigation size={11} className="mr-0.5" />{km(t.distanceM)}</Badge>
                  <Badge tone="navy"><Clock size={11} className="mr-0.5" />{duration(t.durationSec)}</Badge>
                  <Badge tone="green"><Fish size={11} className="mr-0.5" />{t.fishingPoints.length}마리</Badge>
                  {t.topSpecies && <Badge tone="amber"><MapPin size={11} className="mr-0.5" />{t.topSpecies}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
