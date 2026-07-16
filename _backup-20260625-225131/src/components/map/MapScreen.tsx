"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Square, Navigation, Fish, Ruler, MapPin, Plus, Search, Clock } from "lucide-react";
import { MapView } from "@/components/map/MapView";
import { Sheet, Button, Card, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { distanceMeters, mockRoute, type LatLng, type MapMarker } from "@/lib/map";
import { km, duration, timeAgo } from "@/lib/utils";
import { KOREA_SPOTS } from "@/lib/taxonomy";

type Status = "idle" | "tracking" | "paused";

export function MapScreen() {
  const toast = useToast();
  const [center, setCenter] = useState<LatLng>({ lat: KOREA_SPOTS[0].lat, lng: KOREA_SPOTS[0].lng });
  const [route, setRoute] = useState<LatLng[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const watchId = useRef<number | null>(null);
  const mockTimer = useRef<any>(null);
  const clock = useRef<any>(null);
  const mockIdx = useRef(0);

  // 공개 피싱 포인트 로드
  useEffect(() => {
    fetch("/api/points").then((r) => r.json()).then((d) => setPoints(d.points || []));
    // 초기 위치 시도
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, { enableHighAccuracy: true, timeout: 4000 }
      );
    }
    return () => stopAll();
  }, []);

  function stopAll() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (mockTimer.current) clearInterval(mockTimer.current);
    if (clock.current) clearInterval(clock.current);
  }

  function addPoint(p: LatLng) {
    setRoute((r) => {
      if (r.length > 0) setDistance((d) => d + distanceMeters(r[r.length - 1], p));
      return [...r, p];
    });
    setCenter(p);
  }

  function startTracking() {
    setStatus("tracking");
    clock.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => addPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { startMock(); toast("위치 권한이 없어 시뮬레이션 경로로 진행합니다", "info"); },
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    } else {
      startMock();
    }
  }

  function startMock() {
    const path = mockRoute(center);
    mockIdx.current = 0;
    if (mockTimer.current) clearInterval(mockTimer.current);
    mockTimer.current = setInterval(() => {
      if (mockIdx.current >= path.length) { mockIdx.current = 0; }
      addPoint(path[mockIdx.current]);
      mockIdx.current++;
    }, 1500);
  }

  function pause() {
    setStatus("paused");
    if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (mockTimer.current) { clearInterval(mockTimer.current); mockTimer.current = null; }
    if (clock.current) { clearInterval(clock.current); clock.current = null; }
  }

  function finish() {
    stopAll();
    setStatus("idle");
    toast(`낚시 종료 — ${km(distance)}, ${duration(elapsed)}`, "success");
    setRoute([]); setDistance(0); setElapsed(0);
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
    <div className="relative h-[calc(100vh-4.5rem)] w-full md:h-screen">
      {/* 검색 바 */}
      <div className="absolute inset-x-4 top-4 z-[5] flex items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-3 shadow-card backdrop-blur">
        <Search size={16} className="text-navy-300" />
        <span className="text-[14px] text-navy-300">낚시 포인트 검색</span>
      </div>

      {/* 지역 빠른 이동 */}
      <div className="absolute left-0 right-0 top-[68px] z-[5] flex gap-2 overflow-x-auto p-3 no-scrollbar">
        {KOREA_SPOTS.map((s) => (
          <button key={s.name} onClick={() => setCenter({ lat: s.lat, lng: s.lng })}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-navy-700 shadow-card backdrop-blur btn-press transition-colors hover:bg-white">
            <MapPin size={13} className="text-aqua-500" />{s.name}
          </button>
        ))}
      </div>

      <MapView center={center} route={route} markers={markers} onMarkerClick={(m) => m.data && setSelected(m.data)} />

      {/* 통계 + 컨트롤 */}
      <div className="pb-safe absolute bottom-0 left-0 right-0 z-[5] p-3">
        <div className="mx-auto max-w-[640px] rounded-2xl bg-white/95 p-3 shadow-card backdrop-blur">
          <div className="mb-3 grid grid-cols-3 divide-x divide-navy-100 text-center">
            <Metric icon={<Navigation size={15} />} label="이동거리" value={km(distance)} />
            <Metric icon={<Play size={15} />} label="경과시간" value={duration(elapsed)} />
            <Metric icon={<Fish size={15} />} label="포인트" value={`${route.length}`} />
          </div>
          <div className="flex justify-center gap-2">
            {status === "idle" && (
              <>
                <Button onClick={startTracking} variant="primary" full leftIcon={<Clock size={18} />}>기록 시작</Button>
                <Button onClick={locateMe} variant="outline" full leftIcon={<Navigation size={18} />}>내 위치</Button>
              </>
            )}
            {status === "tracking" && (
              <>
                <Button onClick={pause} variant="outline" full leftIcon={<Pause size={18} />}>일시정지</Button>
                <Link href="/catch/new" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-aqua-500 py-2.5 text-[15px] font-semibold text-white shadow-soft btn-press transition-colors hover:bg-aqua-600">
                  <Plus size={18} /> 물고기 기록
                </Link>
                <Button onClick={finish} variant="danger" aria-label="종료"><Square size={18} /></Button>
              </>
            )}
            {status === "paused" && (
              <>
                <Button onClick={startTracking} full leftIcon={<Play size={18} />}>다시 시작</Button>
                <Button onClick={finish} variant="danger" full leftIcon={<Square size={18} />}>종료</Button>
              </>
            )}
          </div>
        </div>
      </div>

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
              <Link href={`/post/${selected.postId}`} className="mt-4 block rounded-xl bg-navy-700 py-3 text-center text-sm font-semibold text-white shadow-soft btn-press transition-colors hover:bg-navy-800">
                피드 게시글 보기
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
