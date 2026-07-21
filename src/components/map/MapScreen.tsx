"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Play, Pause, Square, Navigation, Fish, Ruler, MapPin, Search, Clock, ClipboardList, Share2, ChevronRight, MapPinOff, ChevronDown, ChevronUp, Trash2, Maximize2, Expand, X, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MapView } from "@/components/map/MapView";
import { Sheet, Button, Card, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useRecording, type TripRec } from "@/components/RecordingProvider";
import { TripDetailSheet, type TripDetail } from "@/components/TripDetailSheet";
import { AiPointRecommend } from "@/components/AiPointRecommend";
import { distanceMeters, type LatLng, type MapMarker } from "@/lib/map";
import { km, duration, stopwatch, timeAgo } from "@/lib/utils";
import { KOREA_SPOTS } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";

export function MapScreen() {
  const toast = useToast();
  // 기록 세션은 전역(RecordingProvider)에서 관리 — 페이지를 벗어나거나 새로고침/재실행해도 유지됨
  const { status, route, distance, elapsed, savedTrips, activeCatches, start, pause, finish, postToFeed, removeTrip, lastPoint } = useRecording();
  const [center, setCenter] = useState<LatLng>({ lat: KOREA_SPOTS[0].lat, lng: KOREA_SPOTS[0].lng });
  const [points, setPoints] = useState<any[]>([]);
  const [myPoints, setMyPoints] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [detailTrip, setDetailTrip] = useState<{ tripId?: string | null; initial?: TripDetail | null } | null>(null);
  // 마지막 기록 카드 접기/펼치기
  const [lastRecOpen, setLastRecOpen] = useState(true);
  // 피쉬 기록 없음 팝업
  const [noCatchModal, setNoCatchModal] = useState(false);
  // 기록 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<TripRec | null>(null);

  // ---- 낚시 포인트 검색 ----
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const spotResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return KOREA_SPOTS.filter((s) => s.name.includes(searchQuery)).slice(0, 3);
  }, [searchQuery]);

  const pointResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase();
    return myPoints
      .filter((p) =>
        (p.speciesName && p.speciesName.toLowerCase().includes(q)) ||
        (p.region && p.region.toLowerCase().includes(q)) ||
        (p.gearSetup && p.gearSetup.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [searchQuery, myPoints]);

  // ---- 지도 상세 풀스크린 모드 (배경 모드 bgMode 와 별개) ----
  const [mapDetailMode, setMapDetailMode] = useState(false);

  // ---- 풀스크린 배경 모드 ----
  const [bgMode, setBgMode] = useState(false);
  const [screenOff, setScreenOff] = useState(false);
  const [bgClock, setBgClock] = useState<Date>(() => new Date());
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgClockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleBgInteraction() {
    setScreenOff(false);
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setScreenOff(true), 60_000);
  }

  useEffect(() => {
    if (!bgMode) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (bgClockIntervalRef.current) clearInterval(bgClockIntervalRef.current);
      setScreenOff(false);
      return;
    }
    setBgClock(new Date());
    bgClockIntervalRef.current = setInterval(() => setBgClock(new Date()), 1000);
    handleBgInteraction();
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (bgClockIntervalRef.current) clearInterval(bgClockIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgMode]);

  // 데이터피싱 종료 시 배경 모드 자동 해제
  useEffect(() => { if (status === "idle") setBgMode(false); }, [status]);

  // GPS idle 상태 추적 (기록 전에도 현재 위치 마커 표시)
  const [idlePos, setIdlePos] = useState<LatLng | null>(null);
  const [gpsAvail, setGpsAvail] = useState<boolean | null>(null); // null=미확인, true/false=결과
  const idleWatchRef = useRef<number | null>(null);

  // 기록 종료 후 동선을 지도에 유지 (finish() 시 route가 초기화돼도 마지막 경로 보존)
  const [finishedRoute, setFinishedRoute] = useState<LatLng[]>([]);
  const prevSavedCount = useRef(0);

  // 내 피싱 포인트만 로드 (다른 사용자 포인트는 지도에 표시 안 함)
  useEffect(() => {
    fetch("/api/points/mine").then((r) => r.json()).then((d) => setMyPoints(d.points || [])).catch(() => {});
  }, []);

  // idle 상태: GPS 현재 위치 실시간 추적 (기록 중에는 RecordingProvider가 담당)
  useEffect(() => {
    if (status !== "idle") {
      // 기록 시작 시 idle GPS watcher 해제
      if (idleWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(idleWatchRef.current);
        idleWatchRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) { setGpsAvail(false); return; }
    setGpsAvail(null);
    idleWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setIdlePos(p);
        setGpsAvail(true);
        setCenter(p);
      },
      () => { setGpsAvail(false); },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => {
      if (idleWatchRef.current !== null) {
        navigator.geolocation.clearWatch(idleWatchRef.current);
        idleWatchRef.current = null;
      }
    };
  }, [status]);

  // 새 기록이 저장되면(finish 완료) 동선을 지도에 표시
  useEffect(() => {
    if (savedTrips.length > prevSavedCount.current) {
      const newest = savedTrips[0];
      if (newest.route && newest.route.length > 1) {
        setFinishedRoute(newest.route);
        // 종료 위치로 지도 중심 이동
        const last = newest.route[newest.route.length - 1];
        setCenter(last);
      }
    }
    prevSavedCount.current = savedTrips.length;
  }, [savedTrips]);

  // 새 기록 시작 시 이전 완료 동선 초기화
  useEffect(() => {
    if (status === "tracking") setFinishedRoute([]);
  }, [status]);

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

  // 지도에 표시할 동선: 기록 중이면 실시간 route, idle이면 마지막 완료 동선
  const displayRoute = status !== "idle" ? route : finishedRoute;

  // 피쉬 마커: 위치가 있는 activeCatches를 30m 반경으로 그룹핑
  const catchGroups: { position: LatLng; catches: typeof activeCatches }[] = [];
  for (const c of activeCatches) {
    if (c.lat == null || c.lng == null) continue;
    const pos: LatLng = { lat: c.lat, lng: c.lng };
    const group = catchGroups.find((g) => distanceMeters(g.position, pos) < 30);
    if (group) {
      group.catches.push(c);
    } else {
      catchGroups.push({ position: pos, catches: [c] });
    }
  }

  // 내 포인트만 지도에 표시
  const allPoints = myPoints;

  const markers: MapMarker[] = [
    // 기록 중: 현재 위치 마커
    ...(route.length > 0 ? [{ id: "me", position: route[route.length - 1], kind: "current" as const, title: "현재 위치" }] : []),
    // idle: GPS 현재 위치 마커 (기록 전에도 표시)
    ...(status === "idle" && idlePos ? [{ id: "idle-me", position: idlePos, kind: "current" as const, title: "내 위치" }] : []),
    // 피싱 포인트 — 물고기 마커 (사진 섬네일)
    ...allPoints.map((p) => ({
      id: p.id,
      position: { lat: p.lat, lng: p.lng },
      kind: "fish" as const,
      title: p.speciesName ?? "피싱 포인트",
      data: { ...p, count: 1, photoUrl: p.photoUrl },
    })),
    // 현재 세션 피쉬 마커 (물고기 아이콘)
    ...catchGroups.map((g, i) => ({
      id: `fish-catch-${i}`,
      position: g.position,
      kind: "fish" as const,
      title: g.catches.length > 1 ? `${g.catches.length}마리` : (g.catches[0]?.speciesName ?? "피쉬"),
      data: { count: g.catches.length, catches: g.catches },
    })),
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

  // GPS 버튼 클릭 — 꺼져 있으면 권한 재요청, 켜져 있으면 현재 위치로 이동
  function requestGps() {
    if (!navigator.geolocation) {
      toast("이 브라우저는 GPS를 지원하지 않습니다", "info");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setIdlePos(p);
        setGpsAvail(true);
        setCenter(p);
        toast("GPS가 켜졌습니다", "success");
      },
      () => {
        setGpsAvail(false);
        toast("GPS 권한을 허용해 주세요. 브라우저 설정에서 위치 권한을 확인해 주세요.", "info");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="relative h-[calc(100vh-7.5rem)] w-full md:h-[calc(100vh-3rem)]">
      {/* 상단 컨트롤 영역 — 2행 레이아웃 */}
      <div className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-2">
        {/* 1행: 검색 + 내기록 */}
        <div className="flex items-center gap-2">
        {/* 검색 입력 + 드롭다운 */}
        <div className="relative flex flex-1 items-center gap-2.5 rounded-2xl bg-[#161616]/95 px-3.5 py-2.5 shadow-card backdrop-blur">
          <Search size={15} className="shrink-0 text-navy-300" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setSearchFocused(false); searchInputRef.current?.blur(); } }}
            placeholder="낚시 포인트 검색"
            className="flex-1 bg-transparent text-[13px] text-navy-700 placeholder:text-navy-300 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="shrink-0 text-navy-400 hover:text-navy-700">
              <X size={13} />
            </button>
          )}

          {/* 드롭다운 결과 */}
          {searchFocused && (spotResults.length > 0 || pointResults.length > 0 || searchQuery.length >= 2) && (
            <div className="absolute left-0 right-0 top-full z-[1002] mt-1.5 overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card">
              {spotResults.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-navy-400">지역</p>
                  {spotResults.map((s) => (
                    <button
                      key={s.name}
                      onMouseDown={() => { setCenter({ lat: s.lat, lng: s.lng }); setSearchQuery(s.name); setSearchFocused(false); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-navy-50"
                    >
                      <MapPin size={14} className="shrink-0 text-aqua-400" />
                      <span className="text-[13px] font-semibold text-navy-700">{s.name}</span>
                    </button>
                  ))}
                </>
              )}
              {pointResults.length > 0 && (
                <>
                  <p className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-navy-400${spotResults.length > 0 ? " border-t border-navy-100" : ""}`}>낚시 포인트</p>
                  {pointResults.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={() => { setCenter({ lat: p.lat, lng: p.lng }); setSelected(p); setSearchQuery(p.speciesName || p.region || ""); setSearchFocused(false); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-navy-50"
                    >
                      <Fish size={14} className="shrink-0 text-green-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-navy-700">{p.speciesName || "어종 미상"}</p>
                        {p.region && <p className="truncate text-[11px] text-navy-400">{p.region}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {searchQuery.length >= 2 && spotResults.length === 0 && pointResults.length === 0 && (
                <p className="py-5 text-center text-[13px] text-navy-400">검색 결과가 없습니다</p>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setRecordsOpen(true)}
          aria-label="내 데이터피싱 기록"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#161616]/95 px-3 py-2.5 text-[12px] font-semibold text-navy-700 shadow-card backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]"
        >
          <ClipboardList size={15} className="text-orange-500" />
          내 기록
        </button>
        </div>
        {/* 2행: AI 포인트 추천 */}
        <div className="flex">
          <AiPointRecommend variant="bar" />
        </div>
      </div>

      {/* 지역 빠른 이동 */}
      <div className="absolute left-0 right-0 top-[108px] z-[1000] flex gap-2 overflow-x-auto p-3 no-scrollbar">
        {KOREA_SPOTS.map((s) => (
          <button key={s.name} onClick={() => setCenter({ lat: s.lat, lng: s.lng })}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-[#161616]/95 px-3 py-1.5 text-[12px] font-semibold text-navy-700 shadow-card backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]">
            <MapPin size={13} className="text-aqua-500" />{s.name}
          </button>
        ))}
      </div>

      <MapView center={center} route={displayRoute} markers={markers} onMarkerClick={(m) => m.data && setSelected(m.data)} />

      {/* 포인트 상세 보기 — 지역 탭 바로 아래 우측 */}
      <button
        onClick={() => setMapDetailMode(true)}
        aria-label="포인트 상세 보기 (지도 전체화면)"
        className="absolute right-3 top-[158px] z-[1000] inline-flex items-center gap-1.5 rounded-2xl bg-[#161616]/95 px-3 py-2.5 text-[12px] font-semibold text-navy-700 shadow-card ring-1 ring-white/10 backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]"
      >
        <Expand size={15} className="text-aqua-400" /> 포인트 상세 보기
      </button>

      {/* 통계 + 컨트롤 — 모바일: fixed(nav 위), PC: absolute(지도 하단) */}
      <div className="map-controls-bar">
        <div className="mx-auto max-w-[640px] rounded-2xl bg-[#161616]/95 p-3 shadow-card backdrop-blur">
          {/* GPS 꺼짐 경고 */}
          {status === "idle" && gpsAvail === false && (
            <div className="mb-2 overflow-hidden rounded-2xl ring-1 ring-orange-500/30" style={{ background: "linear-gradient(135deg,#1a1000 0%,#1e1200 100%)" }}>
              <div className="h-[2px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400 to-orange-700/30" />
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 ring-1 ring-orange-500/25">
                  <MapPinOff size={15} className="text-orange-400" strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-orange-300">GPS가 꺼져 있습니다</p>
                  <p className="text-[11px] text-orange-400/60">위치 권한을 허용하거나 GPS를 켜주세요</p>
                </div>
                <button
                  onClick={requestGps}
                  className="shrink-0 rounded-xl bg-orange-500/20 px-2.5 py-1.5 text-[11px] font-bold text-orange-300 ring-1 ring-orange-500/30 transition-colors active:opacity-70"
                >
                  켜기
                </button>
              </div>
            </div>
          )}
          {/* 마지막 기록 요약 — 기록 종료 후 idle 상태에서 표시 */}
          {status === "idle" && savedTrips.length > 0 && (() => {
            const last = savedTrips[0];
            return (
              <div className="mb-2 overflow-hidden rounded-xl border border-aqua-500/25 bg-aqua-500/10">
                <button
                  onClick={() => setLastRecOpen(v => !v)}
                  className="flex w-full items-center justify-between px-3 py-2"
                >
                  <span className="text-[12px] font-bold text-aqua-400">마지막 기록</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-navy-300">
                    {timeAgo(last.createdAt)}
                    {lastRecOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </span>
                </button>
                {lastRecOpen && (
                  <div className="border-t border-aqua-500/20 px-3 pb-2.5 pt-2">
                    <div className="flex gap-3 text-center">
                      <div className="flex-1">
                        <p className="text-[10px] text-navy-400">이동거리</p>
                        <p className="text-[14px] font-bold text-navy-800">{km(last.distanceM)}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-navy-400">경과시간</p>
                        <p className="text-[14px] font-bold text-navy-800">{duration(last.durationSec)}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-navy-400">어획</p>
                        <p className="text-[14px] font-bold text-navy-800">{last.catches?.length ?? 0}마리</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openDetail(last)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-aqua-500/20 py-1.5 text-[12px] font-semibold text-aqua-400"
                    >
                      워킹 상세보기 <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          {/* 종료 후 동선 안내 배지 */}
          {status === "idle" && finishedRoute.length > 1 && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-aqua-500/15 px-3 py-1.5">
              <span className="text-[12px] font-semibold text-aqua-400">마지막 동선이 지도에 표시됩니다</span>
              <button onClick={() => setFinishedRoute([])} className="text-[11px] text-navy-300 hover:text-white">지우기</button>
            </div>
          )}
          <div className="mb-3 grid grid-cols-3 divide-x divide-navy-100 text-center">
            <Metric icon={<Navigation size={15} />} label="이동거리" value={km(distance)} />
            <Metric icon={<Play size={15} />} label="경과시간" value={stopwatch(elapsed)} />
            <Metric icon={<Fish size={15} />} label="어획수" value={`${activeCatches.length}`} />
          </div>
          <div className="flex justify-center gap-2">
            {status === "idle" && (
              <>
                <Button
                  onClick={start}
                  variant="primary"
                  className="flex-1 whitespace-nowrap"
                  leftIcon={<Clock size={18} />}
                >
                  기록 시작
                </Button>
                {/* GPS 토글 버튼 — 켜짐: 컬러/ON, 꺼짐: 흑백/OFF */}
                <button
                  onClick={requestGps}
                  className={[
                    "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] border px-4 py-2.5 text-[14px] font-semibold transition-all btn-press active:scale-[0.97]",
                    gpsAvail
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-400"
                      : "border-navy-100/30 bg-white/5 text-navy-400 grayscale",
                  ].join(" ")}
                >
                  <Navigation size={18} className={gpsAvail ? "text-orange-400" : "text-navy-400"} />
                  GPS {gpsAvail ? "ON" : "OFF"}
                </button>
              </>
            )}
            {status === "tracking" && (
              <>
                <Button onClick={pause} variant="outline" className="flex-1 whitespace-nowrap" leftIcon={<Pause size={18} />}>일시정지</Button>
                <Link
                  href="/measure?from=fishing"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] bg-aqua-500 px-4 py-2.5 text-[15px] font-semibold text-white shadow-soft btn-press transition-colors hover:bg-aqua-600 active:scale-[0.97]"
                >
                  <Fish size={18} /> 피쉬
                </Link>
                <Button onClick={finish} variant="danger" className="flex-1 whitespace-nowrap" leftIcon={<Square size={18} />}>종료</Button>
                {/* 풀스크린 배경 버튼 — 아이콘 전용 */}
                <button
                  onClick={() => setBgMode(true)}
                  aria-label="배경으로 설정"
                  className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-white/5 text-navy-400 ring-1 ring-white/8 transition-colors active:opacity-70 hover:bg-white/10"
                >
                  <Maximize2 size={17} />
                </button>
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
      <Sheet open={recordsOpen} onClose={() => setRecordsOpen(false)} title="내 데이터피싱 기록" size="md">
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
                    {(t.catches?.length ?? 0) > 0 && (
                      <Badge tone="green" className="gap-1"><Fish size={11} />{t.catches!.length}마리</Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-navy-300">
                      {timeAgo(t.createdAt)}<ChevronRight size={13} />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-navy-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label="기록 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1">
                    {t.postId ? (
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-aqua-500">
                        <Share2 size={14} /> 워킹 피드에 게시됨
                      </span>
                    ) : (
                      <Button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try { await postToFeed(t); }
                          catch (err: any) { if (err?.code === "NO_FISH") setNoCatchModal(true); }
                        }}
                        disabled={t.posting} variant="primary" size="sm" full leftIcon={<Share2 size={15} />}
                      >
                        {t.posting ? "올리는 중..." : "워킹 피드에 올리기"}
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); openDetail(t); }}
                    variant="outline"
                    size="sm"
                    leftIcon={<Eye size={14} />}
                  >
                    상세 보기
                  </Button>
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

      {/* ---- 풀스크린 배경 모드 ---- */}
      {bgMode && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9998] select-none"
          style={{ background: "#06080a" }}
          onClick={handleBgInteraction}
        >
          {screenOff ? (
            /* 화면 꺼짐 — 완전히 어두운 상태 */
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-[15px] font-semibold tracking-wide" style={{ color: "rgba(251,146,60,0.7)" }}>탭하여 화면 켜기</p>
            </div>
          ) : (
            /* 화면 켜짐 — 데이터피싱 풀스크린 UI */
            <div className="flex h-full flex-col items-center justify-between px-5 pb-14 pt-16">
              {/* 시계 */}
              <div className="flex flex-col items-center">
                <p className="text-[80px] font-extralight leading-none tracking-tight text-white">
                  {bgClock.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </p>
                <p className="mt-2.5 text-[15px] text-white/45">
                  {bgClock.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
                </p>
              </div>

              {/* 통계 + 컨트롤 */}
              <div className="w-full space-y-3">
                {/* 통계 카드 */}
                <div className="overflow-hidden rounded-[24px] ring-1 ring-white/8" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="px-4 pb-1 pt-3">
                    <p className="text-[11px] font-semibold text-white/30">데이터피싱 진행 중</p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-white/8 pb-4 pt-1 text-center">
                    {[
                      { label: "이동거리", value: km(distance) },
                      { label: "경과시간", value: stopwatch(elapsed) },
                      { label: "어획수", value: `${activeCatches.length}마리` },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-1">
                        <p className="text-[11px] text-white/30">{label}</p>
                        <p className="mt-0.5 text-[22px] font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 컨트롤 버튼 */}
                <div className="flex gap-2.5">
                  {status === "tracking" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); pause(); handleBgInteraction(); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[18px] py-3.5 text-[13px] font-semibold text-white/75 ring-1 ring-white/12"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <Pause size={17} /> 일시정지
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); start(); handleBgInteraction(); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[18px] py-3.5 text-[13px] font-semibold text-white/75 ring-1 ring-white/12"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <Play size={17} /> 재개
                    </button>
                  )}
                  {/* 피쉬 — 물고기 사진 촬영 페이지로 이동 */}
                  <Link
                    href="/measure?from=fishing"
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[18px] py-3.5 text-[13px] font-semibold text-aqua-300 ring-1 ring-aqua-500/30"
                    style={{ background: "rgba(20,184,166,0.12)" }}
                  >
                    <Fish size={17} /> 피쉬
                  </Link>
                  <button
                    onClick={(e) => { e.stopPropagation(); finish(); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[18px] py-3.5 text-[13px] font-semibold text-red-300 ring-1 ring-red-500/30"
                    style={{ background: "rgba(239,68,68,0.12)" }}
                  >
                    <Square size={17} /> 종료
                  </button>
                </div>
              </div>

              {/* 앱으로 돌아가기 */}
              <button
                onClick={(e) => { e.stopPropagation(); setBgMode(false); }}
                className="rounded-[18px] px-10 py-3 text-[14px] font-semibold text-white/40 ring-1 ring-white/10"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                앱으로 돌아가기
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* ---- 지도 상세 풀스크린 (지도만 100vw×100vh, 컨트롤/헤더 없이) ---- */}
      {mapDetailMode && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9990]" style={{ width: "100vw", height: "100vh", background: "#06080a" }}>
          {/* 중심·마커·동선 상태 그대로 전달 — 핀치줌·드래그로 마커 확인 가능 */}
          <MapView center={center} route={displayRoute} markers={markers} onMarkerClick={(m) => m.data && setSelected(m.data)} />

          {/* 닫기 (우측 상단) */}
          <button
            onClick={() => setMapDetailMode(false)}
            aria-label="지도 전체화면 닫기"
            className="absolute right-4 z-[9991] inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#161616]/95 text-navy-800 shadow-card ring-1 ring-white/15 backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]"
            style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
          >
            <X size={20} />
          </button>
        </div>,
        document.body,
      )}

      {/* 피쉬 기록 없음 팝업 — createPortal로 document.body에 렌더 (z-index 스택 탈출) */}
      {noCatchModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-5 backdrop-blur-[3px]">
          <div
            className="w-full max-w-[320px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-aqua-500/20"
            style={{ background: "linear-gradient(160deg,#0c1e2e 0%,#172430 100%)" }}
          >
            {/* 상단 웨이브 스트라이프 */}
            <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/40 via-aqua-400 to-aqua-700/40" />

            <div className="flex flex-col items-center px-6 pb-6 pt-7">
              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-aqua-500/12 ring-1 ring-aqua-500/25">
                <Fish size={26} strokeWidth={1.6} className="text-aqua-400" />
              </div>
              <p className="mt-4 text-center text-[16px] font-bold text-white">피쉬 기록이 없습니다</p>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-white/48">
                워킹 피드를 올리려면 데이터피싱<br />기록 중 물고기를 등록하세요.
              </p>
            </div>

            <div className="h-px bg-white/[0.07]" />
            <button
              type="button"
              onClick={() => setNoCatchModal(false)}
              className="w-full py-4 text-[14px] font-bold text-aqua-400 transition-colors active:opacity-70"
            >
              확인
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* 기록 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="이 기록을 삭제할까요?"
        message="삭제한 데이터피싱 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        danger
        onConfirm={async () => { if (deleteTarget) await removeTrip(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 포인트 상세 시트 */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="피싱 포인트">
        {selected && (
          <div>
            {selected.photoUrl && <img src={selected.photoUrl} alt="잡은 물고기" className="aspect-square w-full rounded-xl object-cover" />}
            <Card className="mt-3 flex items-center gap-2 p-2.5">
              <Link href={`/profile/${selected.user.id}`} className="flex items-center gap-2">
                <img src={getAvatarUrl(selected.user.id, selected.user.avatarUrl)} alt="" className="h-8 w-8 rounded-full object-cover" />
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
            {selected.isMine && selected.tripId && (
              <div className="mt-4">
                <button
                  onClick={() => { setSelected(null); setDetailTrip({ tripId: selected.tripId }); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-aqua-500/15 py-3 text-sm font-semibold text-aqua-400 transition-colors hover:bg-aqua-500/25 btn-press"
                >
                  <ClipboardList size={16} /> 피싱 데이터 보기
                </button>
              </div>
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
