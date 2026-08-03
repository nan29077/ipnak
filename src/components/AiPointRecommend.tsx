"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Sparkles, MapPin, Fish, CalendarDays, Compass, TrendingUp,
  ChevronRight, Loader2, Ruler, Search, Waves, Droplets, Globe, ExternalLink,
  Map as MapIcon, Maximize2, X,
} from "lucide-react";
import { Sheet, Button, Badge, Card, Select } from "@/components/ui";
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
type RecResult = { basis: string; broadened?: boolean; points: RecPoint[]; query: any; webResults?: WebFishReport[] };

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
      if (!status.openaiConfigured && !status.naverConfigured) {
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

            <Button onClick={recommend} disabled={loading} full leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}>
              {loading ? "분석하는 중..." : `${Number(month)}월 ${Number(day)}일 포인트 추천 받기`}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl bg-orange-500/10 px-3 py-2.5">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-orange-400" />
              <p className="text-[13px] leading-relaxed text-navy-700">{data.basis}</p>
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
