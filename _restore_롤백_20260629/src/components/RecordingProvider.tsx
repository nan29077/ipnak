"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { distanceMeters, mockRoute, type LatLng } from "@/lib/map";
import { km, duration } from "@/lib/utils";
import { KOREA_SPOTS } from "@/lib/taxonomy";

export type Status = "idle" | "tracking" | "paused";

export type TripRec = {
  id: string;
  distanceM: number;
  durationSec: number;
  points: number;
  createdAt: string;
  postId?: string | null;
  posting?: boolean;
  route?: LatLng[];
};

type Persisted = {
  v: 1;
  status: Status;
  sessionId: string | null;
  route: LatLng[];
  distance: number;
  baseElapsed: number;
  segmentStartMs: number | null;
};

type RecordingCtx = {
  status: Status;
  route: LatLng[];
  distance: number;
  elapsed: number;
  pointsCount: number;
  lastPoint: LatLng | null;
  savedTrips: TripRec[];
  start: () => void;
  pause: () => void;
  finish: () => void;
  postToFeed: (rec: TripRec) => Promise<void>;
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
  routeRef.current = route;
  distanceRef.current = distance;
  elapsedRef.current = elapsed;
  sessionRef.current = sessionId;

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
      };
      if (status === "idle") localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {}
  }, [status, sessionId, route, distance]);

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
          setStatus(s.status);
          if (s.status === "tracking") {
            // 저장된 시작 시각 기준으로 경과시간을 다시 계산해 끊김 없이 복원
            setElapsed(baseElapsed.current + (Date.now() - (segmentStartMs.current ?? Date.now())) / 1000);
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
          baseElapsed.current = 0;
          segmentStartMs.current = new Date(a.startedAt).getTime();
          setSessionId(a.id);
          setDistance(a.distanceM || 0);
          setStatus("tracking");
          setElapsed(Math.max(0, (Date.now() - segmentStartMs.current) / 1000));
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
    // 서버에 진행 중 세션 생성 후 시작 시각을 서버 기준으로 정렬
    fetch("/api/trips/active", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        const a = d?.active;
        if (a?.id) {
          setSessionId(a.id);
          const serverMs = new Date(a.startedAt).getTime();
          if (Number.isFinite(serverMs)) segmentStartMs.current = serverMs;
        }
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
        body: JSON.stringify({ id: sessionRef.current, distanceM: distanceRef.current, durationSec: baseElapsed.current, points: routeRef.current.length }),
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

    const hasData = snapRoute.length > 0 || finalElapsed >= 1;

    // 상태 초기화 (영속화 제거)
    baseElapsed.current = 0;
    segmentStartMs.current = null;
    setStatus("idle");
    setRoute([]);
    setDistance(0);
    setElapsed(0);
    setSessionId(null);

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
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.id) setSavedTrips((s) => s.map((t) => (t.id === localId ? { ...t, id: d.id } : t)));
      })
      .catch(() => {});
  }, [status, stopWatchers, toast]);

  const postToFeed = useCallback(async (rec: TripRec) => {
    setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: true } : t)));
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "GENERAL",
          caption: `데이터피싱 기록 🎣 이동거리 ${km(rec.distanceM)} · ${duration(rec.durationSec)} · 포인트 ${rec.points}곳`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: false, postId: data.id } : t)));
      toast("피드에 올렸습니다", "success");
    } catch (e: any) {
      setSavedTrips((s) => s.map((t) => (t.id === rec.id ? { ...t, posting: false } : t)));
      toast(e?.message || "피드 게시에 실패했습니다", "error");
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
    start,
    pause,
    finish,
    postToFeed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
