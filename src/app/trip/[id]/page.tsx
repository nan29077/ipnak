import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Clock, Navigation, Fish, MapPin, Thermometer, Wind,
  CloudRain, Sun, Cloud, Zap, CloudSnow, CloudDrizzle, Ruler,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";

export const dynamic = "force-dynamic";

// WMO 날씨코드 → 한국어 설명
function weatherInfo(code: number | null): { label: string; Icon: React.ComponentType<any> } {
  if (code == null) return { label: "날씨 정보 없음", Icon: Cloud };
  if (code === 0) return { label: "맑음", Icon: Sun };
  if (code <= 3) return { label: "구름 조금", Icon: Cloud };
  if (code <= 48) return { label: "안개", Icon: Cloud };
  if (code <= 55) return { label: "이슬비", Icon: CloudDrizzle };
  if (code <= 65) return { label: "비", Icon: CloudRain };
  if (code <= 77) return { label: "눈", Icon: CloudSnow };
  if (code <= 82) return { label: "소나기", Icon: CloudRain };
  return { label: "뇌우", Icon: Zap };
}

function formatDateTime(date: Date) {
  return date.toLocaleString("ko-KR", {
    month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trip = await prisma.fishingTrip.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      routePoints: { orderBy: { order: "asc" } },
      fishingPoints: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!trip) redirect("/trip");

  const endedAt = trip.endedAt ?? new Date(trip.startedAt.getTime() + trip.durationSec * 1000);
  const tripDate = trip.startedAt.toISOString().slice(0, 10);
  const routePoints = trip.routePoints.map((p) => ({ lat: p.lat, lng: p.lng }));

  // 날씨 조회 (Open-Meteo — 무료, API 키 불필요)
  let weather: any = null;
  const firstPt = trip.routePoints[0];
  if (firstPt) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const daysDiff = Math.floor(
        (new Date(today).getTime() - new Date(tripDate).getTime()) / 86400000
      );
      const base =
        daysDiff > 3
          ? "https://archive-api.open-meteo.com/v1/archive"
          : "https://api.open-meteo.com/v1/forecast";
      const url = `${base}?latitude=${firstPt.lat.toFixed(4)}&longitude=${firstPt.lng.toFixed(4)}&start_date=${tripDate}&end_date=${tripDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=Asia%2FSeoul&wind_speed_unit=ms`;
      const r = await fetch(url, { next: { revalidate: 3600 } });
      if (r.ok) weather = await r.json();
    } catch { /* 날씨 조회 실패 시 조용히 무시 */ }
  }

  const wd = weather?.daily;
  const tempMax = wd?.temperature_2m_max?.[0] != null ? Math.round(wd.temperature_2m_max[0]) : null;
  const tempMin = wd?.temperature_2m_min?.[0] != null ? Math.round(wd.temperature_2m_min[0]) : null;
  const precip = wd?.precipitation_sum?.[0] != null ? Number(wd.precipitation_sum[0]).toFixed(1) : null;
  const windSpeed = wd?.windspeed_10m_max?.[0] != null ? Number(wd.windspeed_10m_max[0]).toFixed(1) : null;
  const wCode: number | null = wd?.weathercode?.[0] ?? null;
  const { label: wLabel, Icon: WIcon } = weatherInfo(wCode);

  let catches = trip.fishingPoints;

  // tripId 미연결 레거시 데이터 fallback: 출조 시간 범위로 조회
  if (catches.length === 0) {
    catches = await prisma.fishingPoint.findMany({
      where: {
        userId: trip.userId,
        tripId: null,
        createdAt: {
          gte: trip.startedAt,
          lte: endedAt,
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return (
    <div className="pb-10">
      <PageHeader
        title={trip.title || (trip.region ? `${trip.region} 출조` : "데이터피싱 상세")}
        back
        sub={`${tripDate} · ${trip.region ?? "위치 정보 없음"}`}
      />

      <div className="space-y-3 p-4">

        {/* ── 출조 시간 ── */}
        <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">출조 시간</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <div className="my-1 w-px flex-1 bg-navy-100/40" />
              <div className="h-2.5 w-2.5 rounded-full border-2 border-orange-500 bg-[#1e1e1e]" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="mb-0.5 text-[10px] text-navy-400">시작</p>
                <p className="text-[14px] font-bold text-navy-800">{formatDateTime(trip.startedAt)}</p>
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-navy-400">종료</p>
                <p className="text-[14px] font-bold text-navy-800">{formatDateTime(endedAt)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2">
            <Clock size={14} className="shrink-0 text-orange-400" />
            <p className="text-[13px] font-semibold text-orange-300">총 {formatDuration(trip.durationSec)}</p>
          </div>
        </div>

        {/* ── 통계 ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-3 text-center">
            <Navigation size={18} className="mx-auto mb-1 text-aqua-400" strokeWidth={1.7} />
            <p className="text-[17px] font-extrabold text-navy-800">{formatDist(trip.distanceM)}</p>
            <p className="text-[10px] text-navy-400">이동거리</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-3 text-center">
            <Fish size={18} className="mx-auto mb-1 text-green-400" strokeWidth={1.7} />
            <p className="text-[17px] font-extrabold text-navy-800">{catches.length > 0 ? catches.length : trip.catchCount}</p>
            <p className="text-[10px] text-navy-400">피쉬 기록</p>
          </div>
        </div>

        {/* ── 날씨 정보 ── */}
        <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
            날씨 정보 ({tripDate})
          </p>
          <div className="mb-3 flex items-center gap-2.5">
            <WIcon size={22} strokeWidth={1.6} className="text-aqua-300" />
            <p className="text-[16px] font-bold text-navy-800">{wLabel}</p>
          </div>
          {(tempMax != null || tempMin != null || precip != null || windSpeed != null) ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-surface-200 px-3 py-2.5">
                <Thermometer size={15} className="shrink-0 text-red-400" />
                <div>
                  <p className="text-[10px] text-navy-400">최고기온</p>
                  <p className="text-[15px] font-bold text-navy-800">{tempMax != null ? `${tempMax}°C` : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-200 px-3 py-2.5">
                <Thermometer size={15} className="shrink-0 text-blue-400" />
                <div>
                  <p className="text-[10px] text-navy-400">최저기온</p>
                  <p className="text-[15px] font-bold text-navy-800">{tempMin != null ? `${tempMin}°C` : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-200 px-3 py-2.5">
                <CloudRain size={15} className="shrink-0 text-aqua-400" />
                <div>
                  <p className="text-[10px] text-navy-400">강수량</p>
                  <p className="text-[15px] font-bold text-navy-800">{precip != null ? `${precip}mm` : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-200 px-3 py-2.5">
                <Wind size={15} className="shrink-0 text-navy-400" />
                <div>
                  <p className="text-[10px] text-navy-400">최대풍속</p>
                  <p className="text-[15px] font-bold text-navy-800">{windSpeed != null ? `${windSpeed}m/s` : "—"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-navy-400">
              {firstPt ? "날씨 데이터를 불러오지 못했습니다." : "경로 포인트가 없어 날씨 조회가 불가합니다."}
            </p>
          )}
        </div>

        {/* ── 동선 지도 ── */}
        {routePoints.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">동선 지도</p>
            <div className="h-52 w-full overflow-hidden rounded-2xl border border-navy-100">
              <MiniRouteMap
                points={routePoints}
                catchPoints={catches.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng! }))}
              />
            </div>
          </div>
        )}

        {/* ── 피쉬 기록 ── */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
            피쉬 기록 {catches.length}건
          </p>
          {catches.length === 0 ? (
            <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] py-8 text-center">
              <Fish size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
              <p className="text-[13px] text-navy-400">이 출조에 등록된 피쉬 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {catches.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#1e1e1e] p-3">
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt={c.speciesName || "피쉬"}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-aqua-500/15">
                      <Fish size={20} className="text-aqua-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-navy-800">{c.speciesName || "어종 미상"}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-navy-400">
                      {c.sizeCm != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Ruler size={11} />{c.sizeCm}cm
                        </span>
                      )}
                      {c.region && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={11} />{c.region}
                        </span>
                      )}
                      <span>
                        {new Date(c.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 전체 목록으로 ── */}
        <Link
          href="/trip"
          className="flex items-center justify-center gap-2 rounded-2xl border border-navy-100 py-3 text-[13px] font-semibold text-navy-400 transition-colors hover:border-orange-500/40 hover:text-orange-400"
        >
          목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
