"use client";
import { useEffect, useState } from "react";
import {
  Navigation, Clock, Fish, MapPin, Thermometer, Wind,
  CloudRain, Sun, Cloud, Zap, CloudSnow, CloudDrizzle, Ruler,
} from "lucide-react";
import { Sheet, Card, Badge, LoadingState } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { km, duration } from "@/lib/utils";

export type TripDetail = {
  id: string;
  title?: string | null;
  distanceM: number;
  durationSec: number;
  region?: string | null;
  catchCount?: number;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  routePoints: { lat: number; lng: number }[];
  catches: {
    id?: string;
    speciesName?: string | null;
    sizeCm?: number | null;
    photoUrl?: string | null;
    region?: string | null;
    gearSetup?: string | null;
    createdAt?: string;
    lat?: number | null;
    lng?: number | null;
  }[];
};

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

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("ko-KR", {
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

type WeatherData = {
  label: string;
  Icon: React.ComponentType<any>;
  tempMax: number | null;
  tempMin: number | null;
  precip: string | null;
  windSpeed: string | null;
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
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) { setData(initial); return; }
    if (tripId && !tripId.startsWith("local-")) {
      setLoading(true);
      fetch(`/api/trips/${tripId}`)
        .then((r) => r.json())
        .then((d) => { if (d?.trip) setData(d.trip); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, tripId, initial]);

  // 날씨 조회 (Open-Meteo, 클라이언트)
  useEffect(() => {
    if (!open || !data) return;
    const firstPt = data.routePoints[0];
    if (!firstPt) return;
    const tripDate = (data.startedAt ?? data.createdAt).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const daysDiff = Math.floor(
      (new Date(today).getTime() - new Date(tripDate).getTime()) / 86400000
    );
    const base =
      daysDiff > 3
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";
    const url = `${base}?latitude=${firstPt.lat.toFixed(4)}&longitude=${firstPt.lng.toFixed(4)}&start_date=${tripDate}&end_date=${tripDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=Asia%2FSeoul&wind_speed_unit=ms`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const wd = d?.daily;
        const wCode: number | null = wd?.weathercode?.[0] ?? null;
        const { label, Icon } = weatherInfo(wCode);
        setWeather({
          label,
          Icon,
          tempMax: wd?.temperature_2m_max?.[0] != null ? Math.round(wd.temperature_2m_max[0]) : null,
          tempMin: wd?.temperature_2m_min?.[0] != null ? Math.round(wd.temperature_2m_min[0]) : null,
          precip: wd?.precipitation_sum?.[0] != null ? Number(wd.precipitation_sum[0]).toFixed(1) : null,
          windSpeed: wd?.windspeed_10m_max?.[0] != null ? Number(wd.windspeed_10m_max[0]).toFixed(1) : null,
        });
      })
      .catch(() => {});
  }, [open, data]);

  // 시트 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) { setData(null); setWeather(null); }
  }, [open]);

  const startedAt = data?.startedAt ?? data?.createdAt ?? null;
  const endedAt = data?.endedAt
    ?? (startedAt && data?.durationSec
      ? new Date(new Date(startedAt).getTime() + data.durationSec * 1000).toISOString()
      : null);
  const tripDate = startedAt?.slice(0, 10) ?? "";
  const catchDisplayCount = (data?.catches?.length ?? 0) > 0
    ? data!.catches.length
    : (data?.catchCount ?? 0);

  return (
    <Sheet open={open} onClose={onClose} title="데이터피싱 기록">
      {loading && !data ? (
        <LoadingState label="기록을 불러오는 중..." />
      ) : !data ? (
        <p className="py-12 text-center text-sm text-navy-300">기록 정보를 불러올 수 없습니다.</p>
      ) : (
        <div className="space-y-3">

          {/* ── 출조 시간 ── */}
          <div className="rounded-2xl border border-navy-100 bg-[#161616] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">출조 시간</p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <div className="my-1 w-px flex-1 bg-navy-100/40" />
                <div className="h-2.5 w-2.5 rounded-full border-2 border-orange-500 bg-[#161616]" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="mb-0.5 text-[10px] text-navy-400">시작</p>
                  <p className="text-[14px] font-bold text-navy-800">
                    {startedAt ? formatDateTime(startedAt) : "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] text-navy-400">종료</p>
                  <p className="text-[14px] font-bold text-navy-800">
                    {endedAt ? formatDateTime(endedAt) : "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2">
              <Clock size={14} className="shrink-0 text-orange-400" />
              <p className="text-[13px] font-semibold text-orange-300">총 {formatDuration(data.durationSec)}</p>
            </div>
          </div>

          {/* ── 통계 ── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-navy-100 bg-[#161616] p-3 text-center">
              <Navigation size={18} className="mx-auto mb-1 text-aqua-400" strokeWidth={1.7} />
              <p className="text-[17px] font-extrabold text-navy-800">{formatDist(data.distanceM)}</p>
              <p className="text-[10px] text-navy-400">이동거리</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-[#161616] p-3 text-center">
              <Fish size={18} className="mx-auto mb-1 text-green-400" strokeWidth={1.7} />
              <p className="text-[17px] font-extrabold text-navy-800">{catchDisplayCount}</p>
              <p className="text-[10px] text-navy-400">피쉬 기록</p>
            </div>
          </div>

          {/* ── 날씨 정보 ── */}
          <div className="rounded-2xl border border-navy-100 bg-[#161616] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
              날씨 정보 {tripDate ? `(${tripDate})` : ""}
            </p>
            {data.routePoints.length === 0 ? (
              <p className="text-[12px] text-navy-400">경로 포인트가 없어 날씨 조회가 불가합니다.</p>
            ) : !weather ? (
              <p className="text-[12px] text-navy-400">날씨 정보를 불러오는 중...</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2.5">
                  <weather.Icon size={22} strokeWidth={1.6} className="text-aqua-300" />
                  <p className="text-[16px] font-bold text-navy-800">{weather.label}</p>
                </div>
                {(weather.tempMax != null || weather.tempMin != null || weather.precip != null || weather.windSpeed != null) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-3 py-2.5">
                      <Thermometer size={15} className="shrink-0 text-red-400" />
                      <div>
                        <p className="text-[10px] text-navy-400">최고기온</p>
                        <p className="text-[15px] font-bold text-navy-800">{weather.tempMax != null ? `${weather.tempMax}°C` : "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-3 py-2.5">
                      <Thermometer size={15} className="shrink-0 text-blue-400" />
                      <div>
                        <p className="text-[10px] text-navy-400">최저기온</p>
                        <p className="text-[15px] font-bold text-navy-800">{weather.tempMin != null ? `${weather.tempMin}°C` : "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-3 py-2.5">
                      <CloudRain size={15} className="shrink-0 text-aqua-400" />
                      <div>
                        <p className="text-[10px] text-navy-400">강수량</p>
                        <p className="text-[15px] font-bold text-navy-800">{weather.precip != null ? `${weather.precip}mm` : "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-3 py-2.5">
                      <Wind size={15} className="shrink-0 text-navy-400" />
                      <div>
                        <p className="text-[10px] text-navy-400">최대풍속</p>
                        <p className="text-[15px] font-bold text-navy-800">{weather.windSpeed != null ? `${weather.windSpeed}m/s` : "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── 동선 지도 ── */}
          {data.routePoints.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">동선 지도</p>
              <div className="h-44 w-full overflow-hidden rounded-2xl border border-navy-100">
                <MiniRouteMap
                  points={data.routePoints}
                  catchPoints={data.catches.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng! }))}
                />
              </div>
            </div>
          )}

          {/* ── 피쉬 기록 ── */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
              피쉬 기록 {catchDisplayCount}건
            </p>
            {data.catches.length === 0 ? (
              <div className="rounded-2xl border border-navy-100 bg-[#161616] py-8 text-center">
                <Fish size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                <p className="text-[13px] text-navy-400">이 출조에 등록된 피쉬 기록이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.catches.map((c, i) => (
                  <div key={c.id ?? i} className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#161616] p-3">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.speciesName || "피쉬"} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-aqua-500/15">
                        <Fish size={20} className="text-aqua-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-navy-800">{c.speciesName || "어종 미상"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-navy-400">
                        {c.sizeCm != null && (
                          <span className="inline-flex items-center gap-0.5"><Ruler size={11} />{c.sizeCm}cm</span>
                        )}
                        {c.region && (
                          <span className="inline-flex items-center gap-0.5"><MapPin size={11} />{c.region}</span>
                        )}
                        {c.createdAt && (
                          <span>
                            {new Date(c.createdAt).toLocaleTimeString("ko-KR", {
                              hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
                            })}
                          </span>
                        )}
                      </div>
                      {c.gearSetup && <p className="mt-1 truncate text-[12px] text-navy-400">채비: {c.gearSetup}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </Sheet>
  );
}
