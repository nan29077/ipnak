"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation, Clock, Fish, MapPin, Ruler } from "lucide-react";
import { Sheet, Card, Badge, LoadingState } from "@/components/ui";
import { MiniRoute } from "@/components/MiniRoute";
import { km, duration, timeAgo } from "@/lib/utils";

export type TripDetail = {
  id: string;
  title?: string | null;
  distanceM: number;
  durationSec: number;
  region?: string | null;
  createdAt: string;
  routePoints: { lat: number; lng: number }[];
  catches: {
    id?: string;
    speciesName?: string | null;
    sizeCm?: number | null;
    photoUrl?: string | null;
    region?: string | null;
    gearSetup?: string | null;
    createdAt?: string;
  }[];
};

export function TripDetailSheet({
  open,
  onClose,
  tripId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  tripId?: string | null;
  initial?: TripDetail | null;
}) {
  const [data, setData] = useState<TripDetail | null>(initial ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 메모리에 상세가 있으면 그대로 사용
    if (initial) { setData(initial); return; }
    // 서버 저장 기록은 id로 상세 조회 (local-* 임시 id는 제외)
    if (tripId && !tripId.startsWith("local-")) {
      setLoading(true);
      fetch(`/api/trips/${tripId}`)
        .then((r) => r.json())
        .then((d) => { if (d?.trip) setData(d.trip); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, tripId, initial]);

  return (
    <Sheet open={open} onClose={onClose} title="데이터피싱 기록 상세">
      {loading && !data ? (
        <LoadingState label="기록을 불러오는 중..." />
      ) : !data ? (
        <p className="py-12 text-center text-sm text-navy-300">기록 정보를 불러올 수 없습니다.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[15px] font-bold text-navy-900">
              {data.title || (data.region ? `${data.region} 출조` : "데이터피싱 기록")}
            </p>
            <span className="shrink-0 text-[11px] text-navy-300">{timeAgo(data.createdAt)}</span>
          </div>

          {/* 경로 지도 */}
          <div className="h-44 w-full overflow-hidden rounded-2xl border border-navy-100">
            <MiniRoute points={data.routePoints} />
          </div>

          {/* 거리 · 시간 · 포인트 */}
          <div className="flex flex-wrap gap-2">
            <Badge tone="aqua" className="gap-1"><Navigation size={12} />이동 {km(data.distanceM)}</Badge>
            <Badge tone="navy" className="gap-1"><Clock size={12} />{duration(data.durationSec)}</Badge>
            <Badge tone="green" className="gap-1"><Fish size={12} />{data.routePoints.length}포인트</Badge>
          </div>

          {/* 피쉬 기록 */}
          <div>
            <p className="mb-2 mt-1 text-[12px] font-semibold text-navy-400">피쉬 기록 {data.catches.length}건</p>
            {data.catches.length === 0 ? (
              <Card className="py-6 text-center text-[13px] text-navy-300">이 출조에 등록된 피쉬 기록이 없습니다.</Card>
            ) : (
              <div className="space-y-2">
                {data.catches.map((c, i) => (
                  <Card key={c.id ?? i} className="flex items-center gap-3 p-2.5">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.speciesName || "피쉬"} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-aqua-500/15 text-aqua-300">
                        <Fish size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-800">{c.speciesName || "어종 미상"}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {c.sizeCm != null && <Badge tone="navy" className="gap-1"><Ruler size={11} />{c.sizeCm}cm</Badge>}
                        {c.region && <Badge tone="gray" className="gap-1"><MapPin size={11} />{c.region}</Badge>}
                      </div>
                      {c.gearSetup && <p className="mt-1 truncate text-[12px] text-navy-400">채비: {c.gearSetup}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
