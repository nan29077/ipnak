/**
 * 스마트피싱 기록 공개 열람 뷰 (/trip/{id})
 *
 * 카카오톡·공유 링크로 들어온 사람에게 보여주는 읽기 전용 화면.
 * - 로그인 불필요 (URL 을 아는 사람만 접근)
 * - 본인 기록으로 들어오면 이 뷰 대신 기존 상세 화면이 그대로 렌더된다 (page.tsx 분기)
 */
import Link from "next/link";
import { Clock, Fish, MapPin, Navigation, Ruler, Scale } from "lucide-react";
import { MiniRouteMap } from "@/components/MiniRouteMap";

type PublicCatch = {
  id: string;
  speciesName: string | null;
  sizeCm: number | null;
  photoUrl: string | null;
  region: string | null;
  createdAt: Date;
  weightG: number | null;
  lat: number | null;
  lng: number | null;
};

export type PublicTripData = {
  title: string;
  region: string | null;
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  durationSec: number;
  catchCount: number;
  routePoints: { lat: number; lng: number }[];
  catches: PublicCatch[];
};

function formatDateTime(date: Date) {
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ko-KR", {
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

function formatWeight(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)}kg` : `${Math.round(g)}g`;
}

export function PublicTripView({ trip }: { trip: PublicTripData }) {
  const displayCatchCount = trip.catches.length > 0 ? trip.catches.length : trip.catchCount;
  const catchPoints = trip.catches
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ lat: c.lat!, lng: c.lng! }));

  return (
    <div className="pb-10">
      {/* ── 입낚 브랜드 헤더 + CTA ── */}
      <header className="border-b border-navy-100 bg-[#0d1b2a]/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-ipnak-master-transparent-v2.png"
              alt="입낚"
              className="h-7 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="shrink-0 rounded-full bg-orange-500 px-3.5 py-2 text-[12px] font-semibold text-gray-900 transition-colors hover:bg-orange-600"
          >
            입낚에서 스마트피싱 기록하기
          </Link>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {/* ── 기록 요약 ── */}
        <div className="rounded-2xl border border-navy-100 bg-[#162538] p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
            스마트피싱 기록
          </p>
          <h1 className="text-[19px] font-extrabold leading-snug text-navy-900">{trip.title}</h1>
          <div className="mt-2 space-y-1 text-[12px] text-navy-400">
            <p className="flex items-center gap-1.5">
              <Clock size={13} className="shrink-0" />
              {formatDateTime(trip.startedAt)} ~ {formatTime(trip.endedAt)}
            </p>
            {trip.region && (
              <p className="flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0" />
                {trip.region}
              </p>
            )}
          </div>
        </div>

        {/* ── 통계 ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-navy-100 bg-[#162538] p-3 text-center">
            <Navigation size={18} className="mx-auto mb-1 text-aqua-400" strokeWidth={1.7} />
            <p className="text-[16px] font-extrabold text-navy-800">{formatDist(trip.distanceM)}</p>
            <p className="text-[10px] text-navy-400">이동거리</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-[#162538] p-3 text-center">
            <Clock size={18} className="mx-auto mb-1 text-orange-400" strokeWidth={1.7} />
            <p className="text-[16px] font-extrabold text-navy-800">{formatDuration(trip.durationSec)}</p>
            <p className="text-[10px] text-navy-400">출조 시간</p>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-[#162538] p-3 text-center">
            <Fish size={18} className="mx-auto mb-1 text-green-400" strokeWidth={1.7} />
            <p className="text-[16px] font-extrabold text-navy-800">{displayCatchCount}</p>
            <p className="text-[10px] text-navy-400">피쉬 기록</p>
          </div>
        </div>

        {/* ── 동선 지도 ── */}
        {trip.routePoints.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">동선 지도</p>
            <div className="h-52 w-full overflow-hidden rounded-2xl border border-navy-100">
              <MiniRouteMap points={trip.routePoints} catchPoints={catchPoints} />
            </div>
          </div>
        )}

        {/* ── 피쉬 기록 ── */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
            피쉬 기록 {trip.catches.length}건
          </p>
          {trip.catches.length === 0 ? (
            <div className="rounded-2xl border border-navy-100 bg-[#162538] py-8 text-center">
              <Fish size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
              <p className="text-[13px] text-navy-400">이 출조에 등록된 피쉬 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trip.catches.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#162538] p-3"
                >
                  {c.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.photoUrl}
                      alt={c.speciesName || "피쉬"}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-aqua-500/15">
                      <Fish size={20} className="text-aqua-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-navy-800">
                      {c.speciesName || "어종 미상"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-navy-400">
                      {c.sizeCm != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Ruler size={11} />{c.sizeCm}cm
                        </span>
                      )}
                      {c.weightG != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Scale size={11} />{formatWeight(c.weightG)}
                        </span>
                      )}
                      {c.region && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={11} />{c.region}
                        </span>
                      )}
                      <span>{formatTime(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 하단 CTA ── */}
        <Link
          href="/"
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-5 text-center transition-colors hover:bg-orange-500/20"
        >
          <span className="text-[14px] font-bold text-orange-300">
            입낚에서 스마트피싱 기록하기
          </span>
          <span className="text-[11px] text-navy-400">
            AI로 어종·크기를 자동 측정하고 동선까지 기록해 보세요
          </span>
        </Link>
      </div>
    </div>
  );
}
