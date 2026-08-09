"use client";
import { useEffect, useRef, useState } from "react";
import {
  Navigation, Clock, Fish, MapPin, Thermometer, Wind,
  CloudRain, Sun, Cloud, Zap, CloudSnow, CloudDrizzle, Ruler, X, ZoomIn, ArrowLeft, Loader2, Trash2,
} from "lucide-react";
import { Sheet, LoadingState } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { TripShareActions, CAPTURE_IGNORE_ATTR } from "@/components/TripShareActions";
import { FishingSpotSaveModal, type FishingSpotDraft } from "@/components/FishingSpotSaveModal";

type CatchItem = {
  id?: string;
  speciesName?: string | null;
  sizeCm?: number | null;
  photoUrl?: string | null;
  region?: string | null;
  gearSetup?: string | null;
  createdAt?: string;
  lat?: number | null;
  lng?: number | null;
};

type ViewMode = "default" | "catch-detail" | "map-fullscreen";

// BigDataCloud 역지오코딩 훅
function useReverseGeocode(lat: number | null | undefined, lng: number | null | undefined) {
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;
    setLoading(true);
    setLocationName(null);
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ko`
    )
      .then((r) => r.json())
      .then((d) => {
        const name = d.locality || d.city || d.principalSubdivision || null;
        setLocationName(name || "위치 미상");
      })
      .catch(() => {
        setLocationName("위치 미상");
      })
      .finally(() => setLoading(false));
  }, [lat, lng]);

  return { locationName, loading };
}

// 피쉬기록 상세 뷰 (바텀시트 내부용)
function CatchDetailView({ catch: c, onBack }: { catch: CatchItem; onBack: () => void }) {
  const { locationName, loading: geoLoading } = useReverseGeocode(c.lat, c.lng);

  const dateStr = c.createdAt
    ? new Date(c.createdAt).toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Seoul",
      })
    : null;

  return (
    <div className="space-y-3">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl px-2 py-1 text-[13px] font-semibold text-navy-400 transition-colors hover:text-navy-800"
      >
        <ArrowLeft size={15} />
        뒤로
      </button>

      {/* 사진 */}
      <div
        className="w-full overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: "4/3" }}
      >
        {c.photoUrl ? (
          <img
            src={c.photoUrl}
            alt={c.speciesName || "피쉬"}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex min-h-[200px] h-full w-full flex-col items-center justify-center gap-2">
            <Fish size={48} className="text-navy-300" strokeWidth={1.3} />
            <p className="text-[13px] text-navy-400">사진 없음</p>
          </div>
        )}
      </div>

      {/* 어종 */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">어종</p>
        <p className="text-[20px] font-extrabold" style={{ color: "#eab308" }}>
          {c.speciesName || "어종 미상"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* 길이 */}
        {c.sizeCm != null && (
          <div className="rounded-2xl p-3" style={{ backgroundColor: "#0d1b2a" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <Ruler size={13} className="text-navy-400" />
              <p className="text-[10px] text-navy-400">길이</p>
            </div>
            <p className="text-[18px] font-bold text-navy-800">
              {c.sizeCm}
              <span className="ml-0.5 text-[13px] font-normal text-navy-400">cm</span>
            </p>
          </div>
        )}

        {/* 측정 시간 */}
        {dateStr && (
          <div className="rounded-2xl p-3" style={{ backgroundColor: "#0d1b2a" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <Clock size={13} className="text-navy-400" />
              <p className="text-[10px] text-navy-400">측정 시간</p>
            </div>
            <p className="text-[12px] font-semibold leading-tight text-navy-800">{dateStr}</p>
          </div>
        )}
      </div>

      {/* 포인트 위치 */}
      {(c.region || (c.lat != null && c.lng != null)) && (
        <div className="rounded-2xl p-3" style={{ backgroundColor: "#0d1b2a" }}>
          <div className="mb-1 flex items-center gap-1.5">
            <MapPin size={13} className="text-navy-400" />
            <p className="text-[10px] text-navy-400">포인트 위치</p>
          </div>
          {c.region && <p className="text-[13px] font-semibold text-navy-800">{c.region}</p>}
          {c.lat != null && c.lng != null && (
            <p className="mt-0.5 text-[12px] text-navy-500">
              {geoLoading ? "위치 확인 중..." : locationName}
            </p>
          )}
        </div>
      )}

      {/* 채비 */}
      {c.gearSetup && (
        <div className="rounded-2xl p-3" style={{ backgroundColor: "#0d1b2a" }}>
          <p className="mb-1 text-[10px] text-navy-400">채비</p>
          <p className="text-[13px] font-semibold text-navy-800">{c.gearSetup}</p>
        </div>
      )}
    </div>
  );
}

// 지도 전체보기 뷰 (바텀시트 내부용) — 뒤로가기 버튼 없음, X로 복귀
function MapFullscreenView({
  routePoints,
  catchPoints,
}: {
  routePoints: { lat: number; lng: number }[];
  catchPoints: { lat: number; lng: number }[];
}) {
  return (
    <div className="h-[55vh] w-full overflow-hidden rounded-2xl border border-navy-100">
      <MiniRouteMap points={routePoints} catchPoints={catchPoints} interactive />
    </div>
  );
}

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
  catches: CatchItem[];
  walkingFeedPostId?: string | null;
  walkingFeedPublished?: boolean;
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
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
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
  const [viewMode, setViewMode] = useState<ViewMode>("default");
  const [selectedCatch, setSelectedCatch] = useState<CatchItem | null>(null);
  const [walkingFeedPublished, setWalkingFeedPublished] = useState<boolean>(
    initial?.walkingFeedPublished ?? false
  );
  const [publishingFeed, setPublishingFeed] = useState(false);
  const [deletingFeed, setDeletingFeed] = useState(false);
  const [deleteFeedConfirm, setDeleteFeedConfirm] = useState(false);
  // 어장포인트로 저장 모달 (기존 기능과 독립)
  const [spotModalOpen, setSpotModalOpen] = useState(false);
  // default로 돌아올 때 최상단 스크롤 복구에 쓰는 sentinel ref
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevViewModeRef = useRef<ViewMode>("default");
  // PNG 로 저장할 기록 본문 영역 (스크롤로 가려진 부분까지 전체 캡처)
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (initial) setData(initial);
    if (tripId && !tripId.startsWith("local-")) {
      if (!initial) setLoading(true);
      fetch(`/api/trips/${tripId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d?.trip) {
            setData(d.trip);
            setWalkingFeedPublished(d.trip.walkingFeedPublished ?? false);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [open, tripId, initial]);

  // 날씨 조회
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
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
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
    return () => { cancelled = true; };
  }, [open, data]);

  // 시트 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setData(null);
      setWeather(null);
      setViewMode("default");
      setSelectedCatch(null);
      setWalkingFeedPublished(false);
      setPublishingFeed(false);
      setDeletingFeed(false);
      setDeleteFeedConfirm(false);
      setSpotModalOpen(false);
    }
  }, [open]);

  // default로 돌아올 때 스크롤 최상단 복구
  useEffect(() => {
    if (viewMode === "default" && prevViewModeRef.current !== "default") {
      // rAF으로 렌더 후 처리
      requestAnimationFrame(() => {
        topSentinelRef.current?.scrollIntoView({ block: "start" });
      });
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode]);

  async function handlePublishFeed() {
    if (!data || publishingFeed) return;
    setPublishingFeed(true);
    try {
      const res = await fetch(`/api/trips/${data.id}/publish`, { method: "POST" });
      if (res.ok) {
        setWalkingFeedPublished(true);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "워킹피드 게시에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setPublishingFeed(false);
    }
  }

  async function handleDeleteWalkingFeed() {
    if (!data) return;
    if (!deleteFeedConfirm) {
      setDeleteFeedConfirm(true);
      return;
    }
    setDeleteFeedConfirm(false);
    setDeletingFeed(true);
    try {
      const res = await fetch(`/api/trips/${data.id}/walking-feed`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result.error || "워킹피드 삭제에 실패했습니다.");
        return;
      }
      setWalkingFeedPublished(false);
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setDeletingFeed(false);
    }
  }

  // ── 핵심 수정: 비-default 모드에서 X버튼/backdrop/스와이프 → default로 복귀
  // default 모드에서만 실제 onClose(시트 닫기) 호출
  const handleSheetClose = () => {
    if (viewMode !== "default") {
      setViewMode("default");
    } else {
      onClose();
    }
  };

  const startedAt = data?.startedAt ?? data?.createdAt ?? null;
  const endedAt =
    data?.endedAt ??
    (startedAt && data?.durationSec
      ? new Date(new Date(startedAt).getTime() + data.durationSec * 1000).toISOString()
      : null);
  const tripDate = startedAt?.slice(0, 10) ?? "";
  const catchDisplayCount =
    (data?.catches?.length ?? 0) > 0 ? data!.catches.length : (data?.catchCount ?? 0);

  const sheetTitle =
    viewMode === "default"
      ? "스마트피싱 기록"
      : viewMode === "catch-detail"
      ? selectedCatch?.speciesName || "피쉬 기록"
      : "동선 지도";

  // ── 공유 / 이미지 저장에 쓰는 값 ──
  // 저장 파일명: ipnak-record-{날짜}
  const recordDate = tripDate || new Date().toISOString().slice(0, 10);
  const shareTitle = data
    ? `${data.region ? `${data.region} ` : ""}스마트피싱 기록 (${recordDate})`
    : "스마트피싱 기록";
  const shareDescription = data
    ? `이동 ${formatDist(data.distanceM)} · ${formatDuration(data.durationSec)} · 피쉬 ${catchDisplayCount}건`
    : "";
  // 워킹피드에 게시된 기록이면 그 글로, 아니면 홈으로 연결한다.
  // 게시 여부는 "이번 세션에서 게시함(state)" 또는 "서버가 내려준 값(data)" 중 하나라도 참이면 인정한다.
  // (TripCards·그룹 화면은 tripId 없이 initial 만 넘겨서 state 가 갱신되지 않는 경로가 있다)
  const feedPublished = walkingFeedPublished || data?.walkingFeedPublished === true;
  const sharePath =
    feedPublished && data?.walkingFeedPostId ? `/post/${data.walkingFeedPostId}` : "/";
  const shareThumbnail = data?.catches.find((c) => c.photoUrl)?.photoUrl ?? null;
  // 공개 열람 페이지(/trip/{id})로 링크할 수 있는 기록인지 — 로컬 전용 임시 id 는 제외한다.
  // (TripCards·그룹·지도 화면은 tripId 없이 initial 만 넘기므로 data.id 도 함께 본다)
  const rawTripId = tripId ?? data?.id ?? null;
  const shareTripId = rawTripId && !rawTripId.startsWith("local-") ? rawTripId : null;
  // 카카오 피드 카드: 대표 피쉬(가장 큰 개체) 기준으로 눈에 띄는 제목을 만든다.
  const topCatch: CatchItem | null = data?.catches.length
    ? data.catches.reduce((best, c) => ((c.sizeCm ?? -1) > (best.sizeCm ?? -1) ? c : best))
    : null;
  const kakaoTitle =
    topCatch?.speciesName && topCatch.sizeCm != null
      ? `입낚볼로 잡은 ${Math.round(topCatch.sizeCm)}cm ${topCatch.speciesName}! 🎣`
      : topCatch?.speciesName
      ? `입낚에서 만난 ${topCatch.speciesName} 🎣`
      : `${data?.region ? `${data.region} ` : ""}스마트피싱 기록 🎣`;
  // 카카오 카드 설명은 TripShareActions 가 앱 소개 고정 문구로 처리한다(통계 텍스트 미전송).

  // ── 어장포인트 저장용 자동 입력값 ──
  // 위치: 동선 중간 지점(없으면 첫 지점) → 없으면 좌표가 있는 첫 피쉬 기록
  // 어종: 이 출조의 피쉬 기록 어종 목록 / 메모: 출조일
  const spotBase =
    data && data.routePoints.length > 0
      ? data.routePoints[Math.floor(data.routePoints.length / 2)] ?? data.routePoints[0]
      : data?.catches.find((c) => c.lat != null && c.lng != null) ?? null;
  const spotLat = spotBase ? (spotBase as { lat?: number | null }).lat ?? null : null;
  const spotLng = spotBase ? (spotBase as { lng?: number | null }).lng ?? null : null;
  const spotSpecies = data
    ? Array.from(
        new Set(data.catches.map((c) => c.speciesName).filter((v): v is string => !!v))
      ).join(", ")
    : "";
  const spotDraft: FishingSpotDraft | null =
    spotLat != null && spotLng != null
      ? {
          name: data?.region ? `${data.region} 포인트` : "",
          lat: spotLat,
          lng: spotLng,
          species: spotSpecies || null,
          memo: tripDate ? `출조일 ${tripDate}` : null,
        }
      : null;

  return (
    <Sheet
      open={open}
      onClose={handleSheetClose}
      title={sheetTitle}
      size={viewMode === "map-fullscreen" ? "lg" : "diary"}
    >
      {/* ── 피쉬기록 상세 뷰 ── */}
      {viewMode === "catch-detail" && selectedCatch ? (
        <CatchDetailView
          catch={selectedCatch}
          onBack={() => setViewMode("default")}
        />
      ) : viewMode === "map-fullscreen" && data ? (
        /* ── 지도 전체보기 뷰 ── */
        <MapFullscreenView
          routePoints={data.routePoints}
          catchPoints={data.catches
            .filter((c) => c.lat != null && c.lng != null)
            .map((c) => ({ lat: c.lat!, lng: c.lng! }))}
        />
      ) : (
        /* ── 기본 뷰 ── */
        <>
          {/* 스크롤 복구용 최상단 sentinel */}
          <div ref={topSentinelRef} />

          {loading && !data ? (
            <LoadingState label="기록을 불러오는 중..." />
          ) : !data ? (
            <p className="py-12 text-center text-sm text-navy-300">
              기록 정보를 불러올 수 없습니다.
            </p>
          ) : (
            <div className="space-y-3" ref={captureRef}>

              {/* ── 출조 시간 ── */}
              <div className="rounded-2xl border border-navy-100 bg-[#0d1b2a] p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                  출조 시간
                </p>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    <div className="my-1 w-px flex-1 bg-navy-100/40" />
                    <div className="h-2.5 w-2.5 rounded-full border-2 border-orange-500 bg-[#0d1b2a]" />
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
                  <p className="text-[13px] font-semibold text-orange-300">
                    총 {formatDuration(data.durationSec)}
                  </p>
                </div>
              </div>

              {/* ── 통계 ── */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-navy-100 bg-[#0d1b2a] p-3 text-center">
                  <Navigation size={18} className="mx-auto mb-1 text-aqua-400" strokeWidth={1.7} />
                  <p className="text-[17px] font-extrabold text-navy-800">
                    {formatDist(data.distanceM)}
                  </p>
                  <p className="text-[10px] text-navy-400">이동거리</p>
                </div>
                <div className="rounded-2xl border border-navy-100 bg-[#0d1b2a] p-3 text-center">
                  <Fish size={18} className="mx-auto mb-1 text-green-400" strokeWidth={1.7} />
                  <p className="text-[17px] font-extrabold text-navy-800">{catchDisplayCount}</p>
                  <p className="text-[10px] text-navy-400">피쉬 기록</p>
                </div>
              </div>

              {/* ── 날씨 정보 ── */}
              <div className="rounded-2xl border border-navy-100 bg-[#0d1b2a] p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                  날씨 정보 {tripDate ? `(${tripDate})` : ""}
                </p>
                {data.routePoints.length === 0 ? (
                  <p className="text-[12px] text-navy-400">
                    경로 포인트가 없어 날씨 조회가 불가합니다.
                  </p>
                ) : !weather ? (
                  <p className="text-[12px] text-navy-400">날씨 정보를 불러오는 중...</p>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-2.5">
                      <weather.Icon size={22} strokeWidth={1.6} className="text-aqua-300" />
                      <p className="text-[16px] font-bold text-navy-800">{weather.label}</p>
                    </div>
                    {(weather.tempMax != null ||
                      weather.tempMin != null ||
                      weather.precip != null ||
                      weather.windSpeed != null) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 rounded-xl bg-[#162538] px-3 py-2.5">
                          <Thermometer size={15} className="shrink-0 text-red-400" />
                          <div>
                            <p className="text-[10px] text-navy-400">최고기온</p>
                            <p className="text-[15px] font-bold text-navy-800">
                              {weather.tempMax != null ? `${weather.tempMax}°C` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-[#162538] px-3 py-2.5">
                          <Thermometer size={15} className="shrink-0 text-blue-400" />
                          <div>
                            <p className="text-[10px] text-navy-400">최저기온</p>
                            <p className="text-[15px] font-bold text-navy-800">
                              {weather.tempMin != null ? `${weather.tempMin}°C` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-[#162538] px-3 py-2.5">
                          <CloudRain size={15} className="shrink-0 text-aqua-400" />
                          <div>
                            <p className="text-[10px] text-navy-400">강수량</p>
                            <p className="text-[15px] font-bold text-navy-800">
                              {weather.precip != null ? `${weather.precip}mm` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-[#162538] px-3 py-2.5">
                          <Wind size={15} className="shrink-0 text-navy-400" />
                          <div>
                            <p className="text-[10px] text-navy-400">최대풍속</p>
                            <p className="text-[15px] font-bold text-navy-800">
                              {weather.windSpeed != null ? `${weather.windSpeed}m/s` : "—"}
                            </p>
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
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                      동선 지도
                    </p>
                    <button
                      onClick={() => setViewMode("map-fullscreen")}
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      style={{ backgroundColor: "#eab308", color: "#0d1b2a" }}
                      {...{ [CAPTURE_IGNORE_ATTR]: "" }}
                    >
                      <ZoomIn size={12} />
                      크게보기
                    </button>
                  </div>
                  <div className="h-44 w-full overflow-hidden rounded-2xl border border-navy-100">
                    <MiniRouteMap
                      points={data.routePoints}
                      catchPoints={data.catches
                        .filter((c) => c.lat != null && c.lng != null)
                        .map((c) => ({ lat: c.lat!, lng: c.lng! }))}
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
                  <div className="rounded-2xl border border-navy-100 bg-[#0d1b2a] py-8 text-center">
                    <Fish size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                    <p className="text-[13px] text-navy-400">
                      이 출조에 등록된 피쉬 기록이 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.catches.map((c, i) => (
                      <button
                        key={c.id ?? i}
                        onClick={() => {
                          setSelectedCatch(c);
                          setViewMode("catch-detail");
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl border border-navy-100 bg-[#0d1b2a] p-3 text-left transition-all active:scale-[0.98]"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "#eab308";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "";
                        }}
                      >
                        <div className="relative shrink-0">
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={c.speciesName || "피쉬"}
                              className="h-14 w-14 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-aqua-500/15">
                              <Fish size={20} className="text-aqua-300" />
                            </div>
                          )}
                          {/* 확대 힌트 아이콘 */}
                          <div
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full"
                            style={{ backgroundColor: "#eab308" }}
                          >
                            <ZoomIn size={11} style={{ color: "#0d1b2a" }} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-navy-800">
                            {c.speciesName || "어종 미상"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-navy-400">
                            {c.sizeCm != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <Ruler size={11} />
                                {c.sizeCm}cm
                              </span>
                            )}
                            {c.region && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin size={11} />
                                {c.region}
                              </span>
                            )}
                            {c.createdAt && (
                              <span>
                                {new Date(c.createdAt).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                  timeZone: "Asia/Seoul",
                                })}
                              </span>
                            )}
                          </div>
                          {c.gearSetup && (
                            <p className="mt-1 truncate text-[12px] text-navy-400">
                              채비: {c.gearSetup}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 워킹피드 게시 + 공유/이미지 저장 ──
                  버튼들은 캡처 이미지에 담기지 않도록 CAPTURE_IGNORE_ATTR 를 붙인다.
                  (기존 "워킹피드에 올리기" 버튼 자체는 그대로 두고 바깥만 감쌌다) */}
              <div {...{ [CAPTURE_IGNORE_ATTR]: "" }} className="space-y-2">

              {/* ── 워킹피드 게시 버튼 (routePoints < 2이면 숨김) ── */}
              {data.routePoints.length >= 2 && (
                walkingFeedPublished ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-aqua-400/40 bg-aqua-400/10 py-3 text-[14px] font-semibold text-aqua-400">
                        워킹피드 게시됨
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteWalkingFeed}
                        disabled={deletingFeed}
                        title={deleteFeedConfirm ? "한 번 더 누르면 삭제됩니다" : "워킹피드 삭제"}
                        className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl transition-colors disabled:opacity-50 ${
                          deleteFeedConfirm
                            ? "bg-red-500/20 text-red-400"
                            : "bg-surface-200 text-navy-400 hover:bg-red-500/10 hover:text-red-400"
                        }`}
                      >
                        {deletingFeed
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Trash2 size={16} strokeWidth={1.8} />}
                      </button>
                    </div>
                    {deleteFeedConfirm && (
                      <p className="text-center text-[11px] font-semibold text-red-400">
                        한 번 더 누르면 워킹피드가 삭제됩니다
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublishFeed}
                    disabled={publishingFeed}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-[14px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 disabled:opacity-50"
                  >
                    {publishingFeed && <Loader2 size={16} className="animate-spin" />}
                    {publishingFeed ? "게시 중..." : "워킹피드에 올리기"}
                  </button>
                )
              )}

              {/* ── 어장포인트로 저장 (신규) — 위치 정보가 있는 기록에서만 노출 ── */}
              {spotDraft && (
                <button
                  type="button"
                  onClick={() => setSpotModalOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-aqua-400/40 bg-aqua-400/10 py-3 text-[14px] font-semibold text-aqua-300 transition-colors hover:bg-aqua-400/20"
                >
                  <MapPin size={16} strokeWidth={1.9} />
                  어장포인트로 저장
                </button>
              )}

              {/* ── 소셜 공유(카카오톡·기타 앱) + 기록 이미지(PNG) 저장 ── */}
              <TripShareActions
                captureRef={captureRef}
                title={shareTitle}
                description={shareDescription}
                thumbnailUrl={shareThumbnail}
                sharePath={sharePath}
                tripId={shareTripId}
                kakaoTitle={kakaoTitle}
                fileName={`ipnak-record-${recordDate}`}
              />
              </div>

            </div>
          )}
        </>
      )}

      {/* ── 어장포인트 저장 모달 (기존 기능과 독립) ── */}
      <FishingSpotSaveModal
        open={spotModalOpen}
        onClose={() => setSpotModalOpen(false)}
        initial={spotDraft}
        sourceType="trip"
        sourceTripId={shareTripId}
      />
    </Sheet>
  );
}
