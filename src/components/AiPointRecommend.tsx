"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Sparkles, MapPin, Fish, CalendarDays, Compass, TrendingUp,
  ChevronRight, Loader2, Ruler, Search, Waves, Droplets, Globe, ExternalLink,
  Map as MapIcon, Maximize2, X,
  Thermometer, Wind, Gauge, Navigation, TrendingDown, Minus, Clock, LocateFixed, Info,
} from "lucide-react";
import { Sheet, Button, Badge, Card, Select, Skeleton } from "@/components/ui";
import { PointMiniMap } from "@/components/map/PointMiniMap";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/lib/map";
import { KOREA_REGIONS } from "@/lib/regions";
import { ALL_SPECIES } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { useToast } from "@/components/Toast";

type MemberPost = {
  id: string; imageUrl: string | null; caption: string | null;
  speciesName: string | null; sizeCm: number | null; fishingType: string | null;
  postType: string; createdAt: string;
  author: { id: string; nickname: string; avatarUrl: string | null };
};
type RecPoint = {
  id: string; name: string; type: string; typeLabel: string; water: "민물" | "바다";
  sido: string; sigungu: string; lat: number; lng: number; postCount: number;
  species: { name: string; count: number }[];
  lastActivity: string | null; score: number; reason: string; posts: MemberPost[];
};
type WebFishReport = { title: string; link: string; description: string; blogger: string; date: string };

// ===== 해양·기상 (공공 API 보강 데이터) =====
// 키가 등록돼 있지 않거나 호출이 실패하면 각 항목이 null 로 내려온다 → 해당 카드만 숨긴다.
type TideEvent = { time: string; label: string; kind: "high" | "low"; levelCm: number | null };
type MarineData = {
  lat: number; lng: number; inland: boolean;
  tide: {
    stationName: string; stationCode: string; distanceKm: number;
    events: TideEvent[]; prev: TideEvent | null; next: TideEvent | null;
    phase: "밀물" | "썰물" | null; progress: number;
    mulddae: string | null; lunarDay: number | null;
  } | null;
  waterTemp: { stationName: string; distanceKm: number; tempC: number; observedAt: string | null } | null;
  wind: { deg: number | null; code: string | null; label: string | null; speedMs: number | null; strength: string | null; source: string } | null;
  pressure: { hpa: number; trend: "rising" | "falling" | "stable"; changeHpa: number | null; source: string } | null;
  air: { tempC: number | null; humidity: number | null; precipitation: string | null; source: string } | null;
  speciesFit: { name: string; water: "민물" | "바다"; status: "최적" | "양호" | "보통" | "비활성" }[];
  configured: { tide: boolean; weather: boolean };
  notes: string[];
  fetchedAt: string;
};

type RecResult = {
  basis: string; broadened?: boolean; points: RecPoint[]; query: any;
  webResults?: WebFishReport[];
  marine?: MarineData | null;
  marineOrigin?: { lat: number; lng: number; origin: "user" | "region" | "point" } | null;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
function daysInMonth(m: number) { return [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] || 31; }

/**
 * 전체 지도로 열 때 추천 포인트가 모두 들어오도록 초기 줌을 고른다.
 * MapCanvas 는 bounds 를 받지 않고 center+zoom 만 받으므로 위경도 폭으로 근사한다.
 * (시·도 '전체' 로 추천받으면 포인트가 전국에 흩어질 수 있다)
 */
function fitZoom(points: RecPoint[]) {
  if (points.length <= 1) return 12;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  // 위도 1도 ≈ 경도 1도 × 0.8 (한국 위도대 기준 보정)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lngs) - Math.min(...lngs)) * 0.8);
  if (span > 3) return 6;
  if (span > 1.5) return 7;
  if (span > 0.7) return 8;
  if (span > 0.3) return 9;
  if (span > 0.15) return 10;
  if (span > 0.07) return 11;
  return 12;
}

export function AiPointRecommend({ variant = "feed" }: { variant?: "feed" | "bar" }) {
  const toast = useToast();
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [sido, setSido] = useState("전체");
  const [sigungu, setSigungu] = useState("전체");
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [species, setSpecies] = useState("전체");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecResult | null>(null);
  // 물때·수온을 실제 출조 지점 기준으로 뽑기 위한 좌표 (사용자가 직접 눌렀을 때만 요청한다)
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // 전체화면 지도 (스마트피싱 지도와 동일한 동선) — null 이면 닫힘.
  // focusId: 선택된 포인트(마커 탭 또는 카드에서 '크게 보기'), zoom: 열 때 정한 초기 줌
  const [mapView, setMapView] = useState<{ focusId: string | null; zoom: number } | null>(null);

  const points = data?.points ?? [];
  const focusPoint = mapView?.focusId ? points.find((p) => p.id === mapView.focusId) ?? null : null;
  const mapCenter = useMemo(() => {
    if (focusPoint) return { lat: focusPoint.lat, lng: focusPoint.lng };
    if (points.length === 0) return { lat: 36.5, lng: 127.8 }; // 대한민국 중앙 (포인트 없을 때)
    return {
      lat: points.reduce((a, p) => a + p.lat, 0) / points.length,
      lng: points.reduce((a, p) => a + p.lng, 0) / points.length,
    };
  }, [focusPoint, points]);
  const mapMarkers: MapMarker[] = useMemo(
    () => points.map((p, i) => ({
      id: p.id,
      position: { lat: p.lat, lng: p.lng },
      kind: "listing" as const,
      title: `${i + 1}. ${p.name}`,
    })),
    [points],
  );

  async function openRecommendation() {
    try {
      const res = await fetch("/api/ai/status", { cache: "no-store" });
      const status = await res.json();
      // 해양·기상 키만 등록돼 있어도 물때·수온 카드 + 데이터 휴리스틱 추천은 의미가 있다.
      if (!status.openaiConfigured && !status.naverConfigured && !status.tideConfigured && !status.weatherConfigured) {
        toast("AI 포인트 추천은 준비 중입니다. 곧 더 정확한 조황 정보로 찾아올게요.", "info");
        return;
      }
      setOpen(true);
    } catch {
      toast("AI 포인트 추천은 준비 중입니다.", "info");
    }
  }

  const sigunguList = useMemo(
    () => KOREA_REGIONS.find((s) => s.name === sido)?.sigungu ?? [],
    [sido]
  );
  const dayList = useMemo(() => Array.from({ length: daysInMonth(Number(month)) }, (_, i) => i + 1), [month]);

  /**
   * 현재 위치 사용 — 물때/수온은 관측소까지의 거리에 민감해서 시·군 중심보다 실제 좌표가 정확하다.
   * 권한 팝업이 뜨는 동작이라 사용자가 버튼을 눌렀을 때만 호출한다.
   */
  function toggleMyLocation() {
    if (myCoords) { setMyCoords(null); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast("이 브라우저에서는 위치 서비스를 지원하지 않습니다.", "info");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast("현재 위치를 기준으로 물때·수온을 확인할게요.", "success");
      },
      (err) => {
        setLocating(false);
        toast(err.code === 1 ? "위치 권한을 허용해 주세요." : "현재 위치를 불러올 수 없습니다.", "info");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function recommend() {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/points/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sido, sigungu,
          month: Number(month), day: Number(day),
          species: species === "전체" ? null : species,
          // 좌표가 없으면 서버가 선택 지역 중심 → 1위 포인트 순으로 대체한다.
          lat: myCoords?.lat ?? null,
          lon: myCoords?.lng ?? null,
        }),
      });
      setData(await res.json());
    } catch {
      setData({ basis: "추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.", points: [], query: {} });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          onClick={openRecommendation}
          aria-label="AI 포인트 추천"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-500/95 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-card backdrop-blur btn-press transition-colors hover:bg-orange-600"
        >
          <Sparkles size={15} />
          AI 포인트 추천
        </button>
      ) : (
        <button
          onClick={openRecommendation}
          aria-label="AI 포인트 추천"
          className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 to-[#0d1b2a] px-4 py-3.5 text-left shadow-card btn-press transition-colors hover:from-orange-500/25"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-soft">
            <Sparkles size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-navy-900">AI 포인트 추천</span>
            <span className="block truncate text-[12px] text-navy-400">회원 조황 데이터로 낚시 명당을 찾아드려요</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-orange-400" />
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="AI 포인트 추천">
        {!data ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-navy-400">
              회원들이 등록한 조황글을 분석해 조건에 맞는 낚시 포인트(명당)를 추천해드려요.
            </p>

            <Field icon={<MapPin size={15} className="text-orange-500" />} label="출조 지역">
              <div className="grid grid-cols-2 gap-2">
                <Select value={sido} onChange={(e) => { setSido(e.target.value); setSigungu("전체"); }}>
                  <option value="전체">시·도 전체</option>
                  {KOREA_REGIONS.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
                </Select>
                <Select value={sigungu} onChange={(e) => setSigungu(e.target.value)} disabled={sido === "전체"}>
                  <option value="전체">{sido === "전체" ? "시·도 먼저 선택" : "시·군·구 전체"}</option>
                  {sigunguList.map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
                </Select>
              </div>
            </Field>

            <Field icon={<CalendarDays size={15} className="text-orange-500" />} label="출조 날짜">
              <div className="grid grid-cols-2 gap-2">
                <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTHS.map((m) => (<option key={m} value={String(m)}>{m}월</option>))}
                </Select>
                <Select value={day} onChange={(e) => setDay(e.target.value)}>
                  {dayList.map((d) => (<option key={d} value={String(d)}>{d}일</option>))}
                </Select>
              </div>
            </Field>

            <Field icon={<Fish size={15} className="text-orange-500" />} label="대상 어종 (선택)">
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="전체">어종 무관</option>
                {ALL_SPECIES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </Select>
            </Field>

            {/* 물때·수온은 관측소 거리에 민감해서 실제 좌표가 있으면 훨씬 정확해진다 (선택) */}
            <button
              type="button"
              onClick={toggleMyLocation}
              disabled={locating}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left ring-1 transition-colors btn-press ${
                myCoords
                  ? "bg-aqua-500/15 ring-aqua-500/30"
                  : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
              }`}
            >
              {locating ? (
                <Loader2 size={15} className="shrink-0 animate-spin text-aqua-400" />
              ) : (
                <LocateFixed size={15} className={`shrink-0 ${myCoords ? "text-aqua-400" : "text-navy-400"}`} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-navy-700">
                  {myCoords ? "현재 위치 기준 물때·수온 사용 중" : "현재 위치로 물때·수온 정확도 높이기"}
                </span>
                <span className="block text-[11px] text-navy-400">
                  {myCoords ? "다시 누르면 해제됩니다" : "선택 안 하면 고른 지역 중심으로 계산해요"}
                </span>
              </span>
            </button>

            <Button onClick={recommend} disabled={loading} full leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}>
              {loading ? "분석하는 중..." : `${Number(month)}월 ${Number(day)}일 포인트 추천 받기`}
            </Button>

            {loading && <RecommendSkeleton />}
          </div>
        ) : (
          <div className="space-y-3 pt-0.5">
            {/* 해양·기상 카드 — 공공 API 키가 없으면 이 블록 전체가 렌더되지 않는다 */}
            <MarineSection marine={data.marine} origin={data.marineOrigin} />

            <div className="rounded-xl bg-orange-500/10 px-3 py-2.5 ring-1 ring-orange-500/20">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="shrink-0 text-orange-400" />
                <span className="text-[12px] font-bold text-orange-400">AI 추천 사유</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-navy-700">{data.basis}</p>
            </div>

            {data.points.length === 0 ? (
              <div className="py-10 text-center">
                <Search size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                <p className="text-[14px] font-semibold text-navy-700">추천할 포인트가 없어요</p>
                <p className="mt-1 text-[12px] text-navy-400">지역을 바꿔보거나 회원들의 조황글이 쌓이면 추천이 정확해져요.</p>
              </div>
            ) : (
              <>
                {/* 추천 포인트 전체를 큰 지도에서 한눈에 — 스마트피싱 지도와 동일한 전체화면 동선 */}
                <button
                  type="button"
                  onClick={() => setMapView({ focusId: null, zoom: fitZoom(data.points) })}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-aqua-500/10 px-3.5 py-3 ring-1 ring-aqua-500/20 btn-press transition-colors hover:bg-aqua-500/20"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aqua-500/20 text-aqua-400">
                    <MapIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-bold text-navy-800">추천 포인트 {data.points.length}곳 지도로 보기</span>
                    <span className="block text-[11px] text-navy-400">전체화면 지도에서 위치를 비교해보세요</span>
                  </span>
                  <Maximize2 size={15} className="shrink-0 text-aqua-400" />
                </button>

                {data.points.map((pt, idx) => (
                  <PointCard
                    key={pt.id}
                    point={pt}
                    rank={idx + 1}
                    // 화면의 Select 값이 아니라 이 결과를 만들 때 서버가 쓴 어종을 넘긴다
                    // (조황글 목록도 이 기준으로 걸러져 내려오므로 헤더와 내용이 어긋나지 않는다)
                    species={data.query?.species ?? null}
                    onExpand={() => setMapView({ focusId: pt.id, zoom: 13 })}
                  />
                ))}
              </>
            )}

            {/* ---- 웹 조황 검색 결과 ---- */}
            <WebReportsSection reports={data.webResults} query={data.query} />

            <Button onClick={() => setData(null)} variant="outline" full leftIcon={<ChevronRight size={16} className="rotate-180" />}>
              조건 다시 설정
            </Button>
          </div>
        )}
      </Sheet>

      {/* ---- 추천 포인트 전체화면 지도 ----
          Sheet 가 z-[9999] 이므로 그보다 위에 띄운다. 시트는 열린 채로 두어 닫으면 결과로 바로 복귀한다. */}
      {mapView && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10000]" style={{ width: "100vw", height: "100vh", background: "#06080a" }}>
          <MapView
            center={mapCenter}
            zoom={mapView.zoom}
            markers={mapMarkers}
            onMarkerClick={(m) => setMapView((v) => (v ? { ...v, focusId: m.id } : v))}
          />

          {/* 닫기 (우측 상단) — 스마트피싱 전체화면 지도와 동일 규격 */}
          <button
            onClick={() => setMapView(null)}
            aria-label="지도 전체화면 닫기"
            className="absolute right-4 z-[10001] inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0d1b2a]/95 text-navy-800 shadow-card ring-1 ring-white/15 backdrop-blur btn-press transition-colors hover:bg-[#162538]"
            style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
          >
            <X size={20} />
          </button>

          {/* 선택한 포인트 정보 (마커 탭 또는 카드에서 '크게 보기'로 진입) */}
          {focusPoint && (
            <div
              className="absolute inset-x-3 z-[10001] rounded-2xl bg-[#0d1b2a]/95 px-4 py-3 shadow-card ring-1 ring-white/15 backdrop-blur"
              style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex items-start gap-2">
                <Compass size={15} className="mt-0.5 shrink-0 text-orange-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-navy-900">{focusPoint.name}</p>
                  <p className="mt-0.5 text-[12px] text-navy-400">{focusPoint.reason}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] font-bold text-orange-400">
                  <TrendingUp size={12} />{focusPoint.score}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={focusPoint.water === "바다" ? "aqua" : "green"} className="gap-1">
                  {focusPoint.water === "바다" ? <Waves size={11} /> : <Droplets size={11} />}{focusPoint.typeLabel}
                </Badge>
                <Badge tone="navy" className="gap-1"><MapPin size={11} />{focusPoint.sido} {focusPoint.sigungu}</Badge>
                {focusPoint.postCount > 0 && (
                  <Badge tone="gray" className="gap-1"><Fish size={11} />{focusPoint.postCount}건</Badge>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function WebReportsSection({ reports, query }: { reports?: WebFishReport[]; query: any }) {
  // 네이버 검색 직접 링크 (API 미설정 시에도 항상 노출)
  const naverQuery = [query.sido !== "전체" ? query.sido : "", query.sigungu !== "전체" ? query.sigungu : "", query.species || "", "조황", query.month ? `${query.month}월` : "", query.day ? `${query.day}일` : ""]
    .filter(Boolean).join(" ").trim();
  const naverUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(naverQuery)}&where=blog&sm=tab_opt&nso=so%3Add%2Cp%3A1m`;

  return (
    <div className="mt-1">
      {/* 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-navy-700">
          <Globe size={14} className="text-blue-400" /> 웹 조황 검색
        </span>
        <a href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-navy-300 hover:text-blue-400"
        >
          네이버 검색 더보기 <ExternalLink size={11} />
        </a>
      </div>

      {/* 결과 없음 — API 미설정 시 네이버 링크만 노출 */}
      {(!reports || reports.length === 0) && (
        <a
          href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl bg-blue-500/8 px-3.5 py-3 ring-1 ring-blue-500/15 transition-colors hover:bg-blue-500/15"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-navy-700">"{naverQuery}" 네이버 블로그 검색</p>
            <p className="mt-0.5 text-[11px] text-navy-400">최신 조황 블로그 글을 바로 확인해보세요</p>
          </div>
          <ExternalLink size={15} className="shrink-0 text-blue-400" />
        </a>
      )}

      {/* API 결과 */}
      {reports && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r, i) => (
            <a
              key={i} href={r.link} target="_blank" rel="noopener noreferrer"
              className="flex flex-col gap-0.5 rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/8 transition-colors hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-[13px] font-semibold leading-snug text-navy-800 line-clamp-1">{r.title}</p>
                <ExternalLink size={13} className="mt-0.5 shrink-0 text-navy-400" />
              </div>
              <p className="text-[12px] leading-relaxed text-navy-400 line-clamp-2">{r.description}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-navy-300">
                {r.blogger && <span>{r.blogger}</span>}
                {r.date && <span>· {r.date}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 해양·기상 =====

/** KST 기준 자정으로부터 지난 분 — 브라우저 타임존이 달라도 타임라인이 밀리지 않게 한다. */
function kstMinutesOfDay(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

/** 서버가 만든 "HH:MM" 라벨을 그대로 위치 계산에 쓴다 (KST 고정) */
function minutesOfLabel(label: string) {
  const [h, m] = label.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

const FIT_TONE: Record<string, string> = {
  최적: "bg-emerald-500/15 text-emerald-300",
  양호: "bg-aqua-500/15 text-aqua-300",
  보통: "bg-white/[0.07] text-navy-400",
};

function MarineSection({
  marine, origin,
}: { marine?: MarineData | null; origin?: { origin: "user" | "region" | "point" } | null }) {
  // 공공 API 키 미등록·호출 실패·내륙 지점이면 카드를 아예 그리지 않는다 (기존 추천은 그대로 동작)
  if (!marine) return null;
  const hasAny = Boolean(marine.tide || marine.waterTemp || marine.wind || marine.pressure || marine.air?.tempC != null);
  if (!hasAny) return null;

  const originLabel =
    origin?.origin === "user" ? "현재 위치 기준"
    : origin?.origin === "point" ? "1위 추천 포인트 기준"
    : "선택 지역 기준";

  return (
    <div className="rounded-2xl bg-[#142438] p-3 ring-1 ring-white/8">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Waves size={14} className="shrink-0 text-aqua-400" />
        <span className="text-[12.5px] font-bold text-navy-800">오늘의 물때 · 바다 상황</span>
        <span className="ml-auto text-[10.5px] text-navy-300">{originLabel}</span>
      </div>

      {marine.tide && <TideTimeline tide={marine.tide} />}

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <WaterTempCard temp={marine.waterTemp} airTempC={marine.air?.tempC ?? null} />
        <WindCard wind={marine.wind} />
        <PressureCard pressure={marine.pressure} />
      </div>

      {marine.waterTemp && marine.speciesFit.length > 0 && (
        <div className="mt-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Fish size={12} className="shrink-0 text-aqua-400" />
            <span className="text-[11.5px] font-semibold text-navy-600">
              수온 {marine.waterTemp.tempC}℃ 기준 활성 어종
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {marine.speciesFit.map((s) => (
              <span key={s.name} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${FIT_TONE[s.status] ?? FIT_TONE.보통}`}>
                {s.name} <span className="opacity-70">{s.status}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(marine.tide || marine.waterTemp) && (
        <p className="mt-2 flex items-start gap-1 text-[10.5px] leading-relaxed text-navy-300">
          <Info size={11} className="mt-[1px] shrink-0" />
          국립해양조사원 {marine.tide?.stationName ?? marine.waterTemp?.stationName} 관측소
          {marine.tide?.distanceKm != null && ` (약 ${marine.tide.distanceKm}km)`}
          {marine.air?.source ? ` · ${marine.air.source}` : ""}
          {" · 물때는 음력 기반 근사치예요."}
        </p>
      )}
    </div>
  );
}

function TideTimeline({ tide }: { tide: NonNullable<MarineData["tide"]> }) {
  const nowPct = (kstMinutesOfDay() / 1440) * 100;
  const rising = tide.phase === "밀물";

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {tide.mulddae && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-aqua-500/15 px-2 py-1 text-[11.5px] font-bold text-aqua-300">
            <Waves size={11} />{tide.mulddae}
          </span>
        )}
        {tide.phase && (
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold ${rising ? "bg-orange-500/15 text-orange-400" : "bg-white/[0.07] text-navy-500"}`}>
            {rising ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{tide.phase}
          </span>
        )}
        {tide.next && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-navy-500">
            <Clock size={11} />
            다음 {tide.next.kind === "high" ? "만조" : "간조"} {tide.next.label}
          </span>
        )}
      </div>

      {/* 하루(00~24시) 타임라인 — 고조/저조 지점과 현재 시각 표시 */}
      <div className="relative h-8 overflow-hidden rounded-lg bg-gradient-to-r from-aqua-500/8 via-aqua-500/20 to-aqua-500/8 ring-1 ring-white/8">
        {tide.events.map((e, i) => {
          const pct = (minutesOfLabel(e.label) / 1440) * 100;
          return (
            <span
              key={`${e.time}-${i}`}
              className={`absolute top-0 h-full w-[2px] ${e.kind === "high" ? "bg-aqua-400/70" : "bg-navy-300/40"}`}
              style={{ left: `${pct}%` }}
            />
          );
        })}
        <span
          className="absolute top-0 h-full w-[2px] bg-orange-500"
          style={{ left: `${Math.min(99.6, Math.max(0.4, nowPct))}%` }}
        />
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-semibold text-navy-400">00시</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-semibold text-navy-400">24시</span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {tide.events.map((e, i) => {
          const isNext = tide.next?.time === e.time;
          return (
            <span
              key={`${e.time}-c-${i}`}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                isNext ? "bg-orange-500/15 text-orange-400"
                : e.kind === "high" ? "bg-aqua-500/12 text-aqua-300"
                : "bg-white/[0.06] text-navy-400"
              }`}
            >
              {e.kind === "high" ? "만조" : "간조"} {e.label}
              {e.levelCm != null && <span className="opacity-60">{e.levelCm}cm</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MarineStat({
  icon, label, value, sub, muted,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2.5 py-2.5 ring-1 ring-white/8">
      <div className="flex items-center gap-1">
        <span className={muted ? "text-navy-300" : "text-aqua-400"}>{icon}</span>
        <span className="text-[10.5px] font-semibold text-navy-400">{label}</span>
      </div>
      <div className={`mt-1 text-[15px] font-bold leading-none ${muted ? "text-navy-300" : "text-navy-900"}`}>{value}</div>
      {sub && <div className="mt-1 text-[10.5px] leading-tight text-navy-400">{sub}</div>}
    </div>
  );
}

function WaterTempCard({ temp, airTempC }: { temp: MarineData["waterTemp"]; airTempC: number | null }) {
  if (!temp) {
    return <MarineStat muted icon={<Thermometer size={12} />} label="수온" value="—" sub="정보 없음" />;
  }
  return (
    <MarineStat
      icon={<Thermometer size={12} />}
      label="수온"
      value={<>{temp.tempC}<span className="text-[11px] font-semibold text-navy-400">℃</span></>}
      sub={airTempC != null ? `기온 ${airTempC}℃` : temp.stationName}
    />
  );
}

function WindCard({ wind }: { wind: MarineData["wind"] }) {
  if (!wind || (wind.deg == null && wind.speedMs == null)) {
    return <MarineStat muted icon={<Wind size={12} />} label="바람" value="—" sub="정보 없음" />;
  }
  return (
    <MarineStat
      icon={<Wind size={12} />}
      label="바람"
      value={
        <span className="flex items-center gap-1">
          {wind.deg != null && (
            // 기상학적 풍향은 '불어오는 방향' — 화살표는 바람이 향하는 쪽으로 돌린다
            <Navigation size={14} className="shrink-0 text-aqua-400" style={{ transform: `rotate(${(wind.deg + 180) % 360}deg)` }} />
          )}
          {wind.speedMs != null ? <>{wind.speedMs}<span className="text-[11px] font-semibold text-navy-400">m/s</span></> : (wind.code ?? "—")}
        </span>
      }
      sub={[wind.label ? `${wind.label}풍` : null, wind.code, wind.strength].filter(Boolean).join(" · ")}
    />
  );
}

function PressureCard({ pressure }: { pressure: MarineData["pressure"] }) {
  if (!pressure) {
    return <MarineStat muted icon={<Gauge size={12} />} label="기압" value="—" sub="정보 없음" />;
  }
  const TrendIcon = pressure.trend === "rising" ? TrendingUp : pressure.trend === "falling" ? TrendingDown : Minus;
  const trendText = pressure.trend === "rising" ? "상승" : pressure.trend === "falling" ? "하강" : "안정";
  const tone = pressure.trend === "falling" ? "text-orange-400" : pressure.trend === "rising" ? "text-aqua-400" : "text-navy-400";
  return (
    <MarineStat
      icon={<Gauge size={12} />}
      label="기압"
      value={<>{Math.round(pressure.hpa)}<span className="text-[11px] font-semibold text-navy-400">hPa</span></>}
      sub={
        <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
          <TrendIcon size={10} />{trendText}
          {pressure.changeHpa != null && pressure.changeHpa !== 0 && (
            <span className="opacity-70">{pressure.changeHpa > 0 ? "+" : ""}{pressure.changeHpa}</span>
          )}
        </span>
      }
    />
  );
}

/** 분석 중 자리표시 — 물때/수온 카드와 추천 카드 자리를 미리 잡아 화면이 튀지 않게 한다. */
function RecommendSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      <div className="rounded-2xl bg-[#142438] p-3 ring-1 ring-white/8">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="mt-2.5 h-8 w-full rounded-lg" />
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <Skeleton className="h-[62px] rounded-xl" />
          <Skeleton className="h-[62px] rounded-xl" />
          <Skeleton className="h-[62px] rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-navy-700">{icon}{label}</span>
      {children}
    </label>
  );
}

function PointCard({
  point, rank, species, onExpand,
}: { point: RecPoint; rank: number; species: string | null; onExpand: () => void }) {
  const sea = point.water === "바다";
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[12px] font-bold text-white">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[15px] font-bold text-navy-900">
            <Compass size={14} className="shrink-0 text-orange-400" />
            <span className="truncate">{point.name}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-navy-400">{point.reason}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] font-bold text-orange-400">
          <TrendingUp size={12} />{point.score}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={sea ? "aqua" : "green"} className="gap-1">
          {sea ? <Waves size={11} /> : <Droplets size={11} />}{point.typeLabel}
        </Badge>
        <Badge tone="navy" className="gap-1"><MapPin size={11} />{point.sigungu}</Badge>
        {point.postCount > 0 && <Badge tone="gray" className="gap-1"><Fish size={11} />{point.postCount}건</Badge>}
        {point.species.slice(0, 3).map((s) => (
          <Badge key={s.name} tone="gray" className="gap-1">{s.name} {s.count}</Badge>
        ))}
        {point.lastActivity && <span className="ml-auto self-center text-[11px] text-navy-300">{timeAgo(point.lastActivity)}</span>}
      </div>

      {/* 미니 지도는 미리보기 — 탭하면 전체화면 지도로 전환된다.
          드래그를 끄지 않으면 시트 스크롤과 지도 팬이 서로 먹혀 탭도 잘 안 잡힌다. */}
      <div className="relative mt-3">
        <PointMiniMap lat={point.lat} lng={point.lng} label={point.name} dragging={false} />
        <button
          type="button"
          onClick={onExpand}
          aria-label={`${point.name} 지도 크게 보기`}
          className="absolute inset-0 z-[800] flex items-start justify-end rounded-xl p-2.5"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow backdrop-blur transition-colors hover:bg-black/85">
            <Maximize2 size={13} /> 크게 보기
          </span>
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {/* 어종을 고르면 목록도 그 어종 글만 내려오므로 헤더에 어종을 밝힌다 */}
        <p className="text-[12px] font-semibold text-navy-500">{species ? `${species} 조황글` : "회원 조황글"}</p>
        {point.posts.length === 0 ? (
          <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-center text-[12px] text-navy-400">
            아직 이 포인트에 공유된 회원 글이 없어요.
          </p>
        ) : (
          point.posts.map((mp) => (
            <Link
              key={mp.id}
              href={`/post/${mp.id}`}
              className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                {mp.imageUrl ? (
                  <img src={mp.imageUrl} alt={mp.speciesName || "조황"} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-navy-300"><Fish size={18} /></span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <img src={getAvatarUrl(mp.author.id, mp.author.avatarUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
                  <span className="truncate text-[12px] font-semibold text-navy-700">{mp.author.nickname}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-navy-400">
                  {mp.speciesName && <span className="font-semibold text-orange-400">{mp.speciesName}</span>}
                  {mp.sizeCm != null && <span className="inline-flex items-center gap-0.5"><Ruler size={10} />{mp.sizeCm}cm</span>}
                  <span>· {timeAgo(mp.createdAt)}</span>
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-navy-300" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
