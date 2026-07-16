"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Pause, Square, Navigation, Fish, Ruler, MapPin, Search, Clock, ClipboardList, Share2, ChevronRight } from "lucide-react";
import { MapView } from "@/components/map/MapView";
import { Sheet, Button, Card, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useRecording, type TripRec } from "@/components/RecordingProvider";
import { TripDetailSheet, type TripDetail } from "@/components/TripDetailSheet";
import { AiPointRecommend } from "@/components/AiPointRecommend";
import { type LatLng, type MapMarker } from "@/lib/map";
import { km, duration, stopwatch, timeAgo } from "@/lib/utils";
import { KOREA_SPOTS } from "@/lib/taxonomy";

export function MapScreen() {
  const toast = useToast();
  // 기록 세션은 전역(RecordingProvider)에서 관리 — 페이지를 벗어나거나 새로고침/재실행해도 유지됨
  const { status, route, distance, elapsed, savedTrips, start, pause, finish, postToFeed, lastPoint } = useRecording();
  const [center, setCenter] = useState<LatLng>({ lat: KOREA_SPOTS[0].lat, lng: KOREA_SPOTS[0].lng });
  const [points, setPoints] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [detailTrip, setDetailTrip] = useState<{ tripId?: string | null; initial?: TripDetail | null } | null>(null);

  // 공개 피싱 포인트 로드 + 초기 위치 시도
  useEffect(() => {
    fetch("/api/points").then((r) => r.json()).then((d) => setPoints(d.points || [])).catch(() => {});
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  }, []);

  // 기록 진행 중에는 최신 위치로 지도 중심 이동
  useEffect(() => {
    if (status !== "idle" && lastPoint) setCenter(lastPoint);
  }, [lastPoint, status]);

  function openDetail(rec: TripRec) {
    if (rec.route && rec.route.length > 0) {
      // 방금 기록한 임시 데이터: 메모리의 경로로 즉시 상세 표시
      setDetailTrip({
        initial: {
          id: rec.id,
          distanceM: rec.distanceM,
          durationSec: rec.durationSec,
          createdAt: rec.createdAt,
          routePoints: rec.route,
          catches: [],
        },
      });
    } else {
      // 서버 저장 기록: id로 상세 조회
      setDetailTrip({ tripId: rec.id });
    }
  }

  const markers: MapMarker[] = [
    ...(route.length > 0 ? [{ id: "me", position: route[route.length - 1], kind: "current" as const, title: "현재 위치" }] : []),
    ...points.map((p) => ({ id: p.id, position: { lat: p.lat, lng: p.lng }, kind: "catch" as const, title: `${p.speciesName ?? ""} ${p.sizeCm ?? ""}cm`, data: p })),
  ];

  function locateMe() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast("위치 권한이 없어 이동할 수 없습니다", "info"),
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  }

  return (
    <div className="relative h-[calc(100vh-7.5rem)] w-full md:h-[calc(100vh-3rem)]">
      {/* 검색 바 + 내 기록 */}
      <div className="absolute inset-x-4 top-4 z-[5] flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl bg-[#161616]/95 px-3.5 py-3 shadow-card backdrop-blur">
          <Search size={16} className="text-navy-300" />
          <span className="text-[14px] text-navy-300">낚시 포인트 검색</span>
        </div>
        <AiPointRecommend variant="bar" />
        <button
          onClick={() => setRecordsOpen(true)}
          aria-label="내 데이터피싱 기록"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#161616]/95 px-3.5 py-3 text-[13px] font-semibold text-navy-700 shadow-card backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]"
        >
          <ClipboardList size={16} className="text-orange-500" />
          내 기록
        </button>
      </div>

      {/* 지역 빠른 이동 */}
      <div className="absolute left-0 right-0 top-[68px] z-[5] flex gap-2 overflow-x-auto p-3 no-scrollbar">
        {KOREA_SPOTS.map((s) => (
          <button key={s.name} onClick={() => setCenter({ lat: s.lat, lng: s.lng })}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-[#161616]/95 px-3 py-1.5 text-[12px] font-semibold text-navy-700 shadow-card backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]">
            <MapPin size={13} className="text-aqua-500" />{s.name}
          </button>
        ))}
      </div>

      <MapView center={center} route={route} markers={markers} onMarkerClick={(m) => m.data && setSelected(m.data)} />

      {/* 통계 + 컨트롤 */}
      <div className="pb-safe fixed bottom-16 left-0 right-0 z-[45] p-3 md:absolute md:bottom-0">
        <div className="mx-auto max-w-[640px] rounded-2xl bg-[#161616]/95 p-3 shadow-card backdrop-blur">
          <div className="mb-3 grid grid-cols-3 divide-x divide-navy-100 text-center">
            <Metric icon={<Navigation size={15} />} label="이동거리" value={km(distance)} />
            <Metric icon={<Play size={15} />} label="경과시간" value={stopwatch(elapsed)} />
            <Metric icon={<Fish size={15} />} label="포인트" value={`${route.length}`} />
          </div>
          <div className="flex justify-center gap-2">
            {status === "idle" && (
              <>
                <Button onClick={start} variant="primary" className="flex-1 whitespace-nowrap" leftIcon={<Clock size={18} />}>기록 시작</Button>
                <Button onClick={locateMe} variant="outline" className="flex-1 whitespace-nowrap" leftIcon={<Navigation size={18} />}>내 위치</Button>
              </>
            )}
            {status === "tracking" && (
              <>
                <Button onClick={pause} variant="outline" className="flex-1 whitespace-nowrap" leftIcon={<Pause size={18} />}>일시정지</Button>
                <Link
                  href="/catch/new"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] bg-aqua-500 px-4 py-2.5 text-[15px] font-semibold text-white shadow-soft btn-press transition-colors hover:bg-aqua-600 active:scale-[0.97]"
                >
                  <Fish size={18} /> 피쉬
                </Link>
                <Button onClick={finish} variant="danger" className="flex-1 whitespace-nowrap" leftIcon={<Square size={18} />}>중지</Button>
              </>
            )}
            {status === "paused" && (
              <>
                <Button onClick={start} className="flex-1 whitespace-nowrap" leftIcon={<Play size={18} />}>다시 시작</Button>
                <Button onClick={finish} variant="danger" className="flex-1 whitespace-nowrap" leftIcon={<Square size={18} />}>종료</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 내 데이터피싱 기록 시트 */}
      <Sheet open={recordsOpen} onClose={() => setRecordsOpen(false)} title="내 데이터피싱 기록">
        {savedTrips.length === 0 ? (
          <p className="py-12 text-center text-sm text-navy-300">
            아직 저장된 기록이 없습니다.<br />“기록 시작”으로 동선을 기록해보세요.
          </p>
        ) : (
          <div className="space-y-2.5">
            {savedTrips.map((t) => (
              <Card key={t.id} className="p-3" onClick={() => openDetail(t)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="aqua" className="gap-1"><Navigation size={11} />{km(t.distanceM)}</Badge>
                    <Badge tone="navy" className="gap-1"><Clock size={11} />{duration(t.durationSec)}</Badge>
                    <Badge tone="green" className="gap-1"><Fish size={11} />{t.points}곳</Badge>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-navy-300">
                    {timeAgo(t.createdAt)}<ChevronRight size={13} />
                  </span>
                </div>
                <div className="mt-2.5">
                  {t.postId ? (
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-aqua-500">
                      <Share2 size={14} /> 피싱 피드에 게시됨
                    </span>
                  ) : (
                    <Button
                      onClick={(e) => { e.stopPropagation(); postToFeed(t); }}
                      disabled={t.posting} variant="primary" size="sm" full leftIcon={<Share2 size={15} />}
                    >
                      {t.posting ? "올리는 중..." : "피싱 피드에 올리기"}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Sheet>

      {/* 데이터피싱 기록 상세 시트 */}
      <TripDetailSheet
        open={!!detailTrip}
        onClose={() => setDetailTrip(null)}
        tripId={detailTrip?.tripId}
        initial={detailTrip?.initial}
      />

      {/* 포인트 상세 시트 */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="피싱 포인트">
        {selected && (
          <div>
            {selected.photoUrl && <img src={selected.photoUrl} alt="잡은 물고기" className="aspect-square w-full rounded-xl object-cover" />}
            <Card className="mt-3 flex items-center gap-2 p-2.5">
              <Link href={`/profile/${selected.user.id}`} className="flex items-center gap-2">
                <img src={selected.user.avatarUrl || ""} alt="" className="h-8 w-8 rounded-full object-cover" />
                <span className="text-sm font-semibold text-navy-800">{selected.user.nickname}</span>
              </Link>
              <span className="ml-auto text-xs text-navy-300">{timeAgo(selected.createdAt)}</span>
            </Card>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.speciesName && <Badge tone="aqua" className="gap-1"><Fish size={13} />{selected.speciesName}</Badge>}
              {selected.sizeCm != null && <Badge tone="navy" className="gap-1"><Ruler size={13} />{selected.sizeCm}cm</Badge>}
              {selected.region && <Badge tone="navy" className="gap-1"><MapPin size={13} />{selected.region}</Badge>}
            </div>
            {selected.gearSetup && <p className="mt-2 text-sm text-navy-600">채비: {selected.gearSetup}</p>}
            {selected.blurRadius > 0 && <p className="mt-2 text-xs text-navy-300">※ 위치가 반경 {selected.blurRadius}m로 흐림 처리되었습니다.</p>}
            {selected.postId && (
              <Link href={`/post/${selected.postId}`} className="mt-4 block rounded-xl bg-orange-500 py-3 text-center text-sm font-semibold text-white shadow-soft btn-press transition-colors hover:bg-orange-600">
                피싱 피드 게시글 보기
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-1">
      <p className="flex items-center justify-center gap-1 text-[11px] text-navy-400">{icon}{label}</p>
      <p className="text-base font-bold text-navy-800">{value}</p>
    </div>
  );
}
