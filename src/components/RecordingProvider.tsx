"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { distanceMeters, mockRoute, type LatLng } from "@/lib/map";
import { km, duration } from "@/lib/utils";
import { KOREA_SPOTS } from "@/lib/taxonomy";

export type Status = "idle" | "tracking" | "paused";

export type TripCatch = {
  photoUrl?: string | null;
  speciesName?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type TripRec = {
  id: string;
  distanceM: number;
  durationSec: number;
  points: number;
  createdAt: string;
  postId?: string | null;
  posting?: boolean;
  route?: LatLng[];
  catches?: TripCatch[];
};

type Persisted = {
  v: 1;
  status: Status;
  sessionId: string | null;
  route: LatLng[];
  distance: number;
  baseElapsed: number;
  segmentStartMs: number | null;
  /** 앱 종료 시점의 경과시간 스냅샷 */
  elapsedAtSave?: number;
  /** 앱 종료 시점의 타임스탬프 — 재개 시 닫혀있던 시간을 더해 연속 카운트 */
  savedAt?: number;
  activeCatches?: TripCatch[];
};

type RecordingCtx = {
  status: Status;
  route: LatLng[];
  distance: number;
  elapsed: number;
  pointsCount: number;
  lastPoint: LatLng | null;
  savedTrips: TripRec[];
  activeCatches: TripCatch[];
  sessionId: string | null;
  start: () => void;
  pause: () => void;
  finish: () => void;
  addCatchToRecording: (c: TripCatch) => void;
  postToFeed: (rec: TripRec) => Promise<void>;
  removeTrip: (tripId: string) => Promise<void>;
};

const LS_KEY = "ipnak_rec_v1";
const Ctx = createContext<RecordingCtx | null>(null);

export function useRecording() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRecording must be used within RecordingProvider");
  return c;
}

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [route, setRoute] = useState<LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedTrips, setSavedTrips] = useState<TripRec[]>([]);
  const [activeCatches, setActiveCatches] = useState<TripCatch[]>([]);

  const baseElapsed = useRef(0);
  const segmentStartMs = useRef<number | null>(null);
  const hydrated = useRef(false);

  const watchId = useRef<number | null>(null);
  const mockTimer = useRef<any>(null);
  const mockIdx = useRef(0);

  // 최신 값 참조 (watcher/heartbeat 콜백의 stale closure 방지)
  const routeRef = useRef<LatLng[]>([]);
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const sessionRef = useRef<string | null>(null);
  const catchesRef = useRef<TripCatch[]>([]);
  routeRef.current = route;
  distanceRef.current = distance;
  elapsedRef.current = elapsed;
  sessionRef.current = sessionId;
  catchesRef.current = activeCatches;

  // ---- 경로 추적 ----
  const addPoint = useCallback((p: LatLng) => {
    setRoute((r) => {
      if (r.length > 0) setDistance((d) => d + distanceMeters(r[r.length - 1], p));
      return [...r, p];
    });
  }, []);

  const startMock = useCallback(() => {
    const seed = routeRef.current[routeRef.current.length - 1] || { lat: KOREA_SPOTS[0].lat, lng: KOREA_SPOTS[0].lng };
    const path = mockRoute(seed);
    mockIdx.current = 0;
    if (mockTimer.current) clearInterval(mockTimer.current);
    mockTimer.current = setInterval(() => {
      if (mockIdx.current >= path.length) mockIdx.current = 0;
      addPoint(path[mockIdx.current]);
      mockIdx.current++;
    }, 1500);
  }, [addPoint]);

  const startWatchers = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => addPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { startMock(); toast("위치 권한이 없어 시뮬레이션 경로로 진행합니다", "info"); },
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    } else {
      startMock();
    }
  }, [addPoint, startMock, toast]);

  const stopWatchers = useCallback(() => {
    if (watchId.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (mockTimer.current) clearInterval(mockTimer.current);
    mockTimer.current = null;
  }, []);

  // ---- 영속화 ----
  const persist = useCallback(() => {
    try {
      const data: Persisted = {
        v: 1,
        status,
        sessionId,
        route,
        distance,
        baseElapsed: baseElapsed.current,
        segmentStartMs: segmentStartMs.current,
        // 앱 종료 시점의 경과시간을 저장 → 재개 시 여기서부터 이어 계산
        elapsedAtSave: elapsedRef.current,
        savedAt: Date.now(),
        activeCatches,
      };
      if (status === "idle") localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {}
  }, [status, sessionId, route, distance, activeCatches]);

  useEffect(() => {
    if (!hydrated.current) return;
    persist();
  }, [persist]);

  // ---- 라이브 경과시간 클럭 ----
  useEffect(() => {
    if (status !== "tracking") return;
    const tick = () => setElapsed(baseElapsed.current + (Date.now() - (segmentStartMs.current ?? Date.now())) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  // ---- 서버 하트비트(진행 중 통계 동기화) ----
  useEffect(() => {
    if (status !== "tracking") return;
    const id = setInterval(() => {
      if (!sessionRef.current) return;
      fetch("/api/trips/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionRef.current,
          distanceM: distanceRef.current,
          durationSec: elapsedRef.current,
          points: routeRef.current.length,
          catchCount: catchesRef.current.length,
        }),
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [status]);

  // ---- 마운트: 저장된 세션 복원 + 서버 active 동기화 + 기록 목록 로드 ----
  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s: Persisted = JSON.parse(raw);
        if (s && s.status && s.status !== "idle") {
          baseElapsed.current = s.baseElapsed || 0;
          segmentStartMs.current = s.segmentStartMs ?? null;
          setRoute(Array.isArray(s.route) ? s.route : []);
          setDistance(s.distance || 0);
          setSessionId(s.sessionId ?? null);
          setActiveCatches(Array.isArray(s.activeCatches) ? s.activeCatches : []);
          setStatus(s.status);
          if (s.status === "tracking") {
            // 저장 시점 경과시간 + 앱 닫혀있던 시간 = 연속 카운트
            const closedSec = s.savedAt ? (Date.now() - s.savedAt) / 1000 : 0;
            const resumeBase = (s.elapsedAtSave ?? s.baseElapsed ?? 0) + closedSec;
            baseElapsed.current = resumeBase;
            segmentStartMs.current = Date.now();
            setElapsed(resumeBase);
            startWatchers();
          } else {
            setElapsed(baseElapsed.current);
          }
          restored = true;
        }
      }
    } catch {}

    hydrated.current = true;

    // 서버에 진행 중 세션이 있으면 동기화 (닫혀 있던 동안의 시간도 서버 startedAt 기준으로 반영)
    fetch("/api/trips/active")
      .then((r) => r.json())
      .then((d) => {
        const a = d?.active;
        if (a && !restored) {
          // startedAt 기준 wall-clock 경과시간 → 앱 닫혀있던 시간도 포함
          const startedAtMs = a.startedAt ? new Date(a.startedAt).getTime() : null;
          const wallClock = startedAtMs ? (Date.now() - startedAtMs) / 1000 : null;
          // 비정상적으로 큰 값(24h 초과)이면 서버 durationSec 폴백
          const resumeBase = (wallClock != null && wallClock < 86400) ? wallClock : (a.durationSec ?? 0);
          baseElapsed.current = resumeBase;
          segmentStartMs.current = Date.now();
          setSessionId(a.id);
          setDistance(a.distanceM || 0);
          setStatus("tracking");
          setElapsed(resumeBase);
          startWatchers();
        } else if (a && restored && !sessionRef.current) {
          setSessionId(a.id);
        }
      })
      .catch(() => {});

    fetch("/api/trips")
      .then((r) => r.json())
      .then((d) => setSavedTrips(d.trips || []))
      .catch(() => {});

    return () => stopWatchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 컨트롤 ----
  const start = useCallback(() => {
    if (status === "paused") {
      segmentStartMs.current = Date.now();
      setStatus("tracking");
      startWatchers();
      return;
    }
    // idle → 새 기록
    baseElapsed.current = 0;
    segmentStartMs.current = Date.now();
    setRoute([]);
    setDistance(0);
    setElapsed(0);
    setStatus("tracking");
    startWatchers();
    // 서버에 진행 중 세션 생성 (클라이언트 시작 시각 기준으로만 계산 — 서버 startedAt 동기화 안 함)
    fetch("/api/trips/active", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        const a = d?.active;
        if (a?.id) setSessionId(a.id);
      })
      .catch(() => {});
  }, [status, startWatchers]);

  const pause = useCallback(() => {
    baseElapsed.current = baseElapsed.current + (Date.now() - (segmentStartMs.current ?? Date.now())) / 1000;
    segmentStartMs.current = null;
    setStatus("paused");
    setElapsed(baseElapsed.current);
    stopWatchers();
    if (sessionRef.current) {
      fetch("/api/trips/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionRef.current, distanceM: distanceRef.current, durationSec: baseElapsed.current, points: routeRef.current.length, catchCount: catchesRef.current.length }),
      }).catch(() => {});
    }
  }, [stopWatchers]);

  const finish = useCallback(() => {
    stopWatchers();
    const finalElapsed = status === "tracking"
      ? baseElapsed.current + (Date.now() - (segmentStartMs.current ?? Date.now())) / 1000
      : baseElapsed.current;
    const snapRoute = [...routeRef.current];
    const snapDistance = distanceRef.current;
    const snapSession = sessionRef.current;
    const snapCatches = [...activeCatches];

    const hasData = snapRoute.length > 0 || finalElapsed >= 1;

    // 상태 초기화 (영속화 제거)
    baseElapsed.current = 0;
    segmentStartMs.current = null;
    setStatus("idle");
    setRoute([]);
    setDistance(0);
    setElapsed(0);
    setSessionId(null);
    setActiveCatches([]);

    if (!hasData) {
      // 데이터 없는 세션은 서버에서 폐기
      if (snapSession) {
        fetch("/api/trips/active", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: snapSession }),
        }).catch(() => {});
      }
      return;
    }

    const durSec = Math.round(finalElapsed);
    const localId = `local-${Date.now()}`;
    const rec: TripRec = {
      id: localId,
      distanceM: snapDistance,
      durationSec: durSec,
      points: snapRoute.length,
      createdAt: new Date().toISOString(),
      postId: null,
      route: snapRoute,
      catches: snapCatches,
    };
    setSavedTrips((s) => [rec, ...s]);
    toast(`데이터피싱 기록 저장됨 — ${km(snapDistance)}, ${duration(durSec)}`, "success");

    // 진행 중 세션을 최종 통계/경로로 마감 (PUT)
    fetch("/api/trips/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: snapSession,
        distanceM: snapDistance,
        durationSec: durSec,
        points: snapRoute.map((p, i) => ({ lat: p.lat, lng: p.lng, order: i })),
        catchCount: snapCatches.length,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.id) setSavedTrips((s) => s.map((t) => (t.id === localId ? { ...t, id: d.id } : t)));
      })
      .catch(() => {});
  }, [status, activeCatches, stopWatchers, toast]);

  const addCatchToRecording = useCallback((c: TripCatch) => {
    setActiveCatches((prev) => [...prev, c]);
  }, []);

  const removeTrip = useCallback(async (tripId: string) => {
    // 서버 기록이면 API 삭제, 로컬 기록이면 상태에서만 제거
    if (!tripId.startsWith("local-")) {
      try { await fetch(`/api/trips/${tripId}`, { method: "DELETE" }); } catch { /* noop */ }
    }
    setSavedTrips((s) => s.filter((t) => t.id !== tripId));
  }, []);

  const postToFeed = useCallback(async (rec: TripRec) => {
    setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: true } : t)));
    try {
      // 동선 포인트 수집 — 로컬 기록엔 route 있음, 서버 기록은 API에서 조회
      let routePoints: LatLng[] = rec.route ?? [];
      // 로컬 세션에서 수집된 피쉬 기록 (photoUrl 포함)
      let catchesForPost: TripCatch[] = rec.catches ?? [];

      if (!rec.id.startsWith("local-")) {
        // 서버 저장 기록: 경로 + 피쉬 사진 모두 API에서 조회
        try {
          const r = await fetch(`/api/trips/${rec.id}`);
          const d = await r.json();
          if (d?.trip?.routePoints?.length >= 2) routePoints = d.trip.routePoints;
          // 로컬 catches가 비어있으면 서버 fishingPoints에서 사진 수집
          if (catchesForPost.length === 0 && d?.trip?.catches?.length > 0) {
            catchesForPost = (d.trip.catches as any[]).map((c) => ({
              photoUrl: c.photoUrl ?? null,
              speciesName: c.speciesName ?? null,
              lat: c.lat ?? null,
              lng: c.lng ?? null,
            }));
          }
        } catch {}
      }

      // 이미지: 피쉬 사진들 (지도는 FeedCard에서 routePoints로 직접 렌더링)
      const images: string[] = catchesForPost.filter((c) => c.photoUrl).map((c) => c.photoUrl!);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "WALKING",
          postType: "WALKING_FEED",
          caption: `워킹 피드 — 이동거리 ${km(rec.distanceM)} · ${duration(rec.durationSec)} · 어획 ${catchesForPost.length}마리`,
          // 동선 경로·통계를 body에 JSON으로 저장 → FeedCard에서 지도로 렌더링
          body: JSON.stringify({
            routePoints,
            distanceM: rec.distanceM,
            durationSec: rec.durationSec,
            points: rec.points,
            catchCount: catchesForPost.length,
            catchMarkers: catchesForPost
              .filter((c) => c.lat != null && c.lng != null)
              .map((c) => ({ lat: c.lat!, lng: c.lng! })),
          }),
          images,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: false, postId: data.id } : t)));
      toast("피싱 피드에 올렸습니다", "success");
    } catch (e: any) {
      setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: false } : t)));
      toast(e?.message || "피싱 피드 게시에 실패했습니다", "error");
    }
  }, [toast]);

  const value: RecordingCtx = {
    status,
    route,
    distance,
    elapsed,
    pointsCount: route.length,
    lastPoint: route.length > 0 ? route[route.length - 1] : null,
    savedTrips,
    activeCatches,
    sessionId,
    start,
    pause,
    finish,
    addCatchToRecording,
    postToFeed,
    removeTrip,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
