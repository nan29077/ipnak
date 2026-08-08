"use client";
/**
 * 백그라운드 위치 추적 훅 (워킹 피드 / 스마트피싱 동선용)
 *
 * 왜 필요한가
 * - 웹(브라우저)은 화면이 꺼지거나 앱이 백그라운드로 가면 watchPosition 이 멈춘다.
 *   그래서 기존 웹 구현은 Wake Lock + 폴백 타이머로 버티고 있다.
 * - 앱에서는 OS 의 백그라운드 위치 서비스를 쓰면 화면이 꺼져도 동선이 끊기지 않는다.
 *
 * 동작 환경
 * - 앱 + @capacitor-community/background-geolocation 설치 시: 진짜 백그라운드 추적
 * - 앱 + 플러그인 미설치: @capacitor/geolocation watchPosition 으로 폴백(포그라운드 한정)
 * - 웹: 아무것도 하지 않는다 (isSupported=false). 기존 RecordingProvider 동작에 영향 없음.
 *
 * ※ 이 훅은 기존 기록 로직(RecordingProvider)을 수정하지 않는 독립 유틸이다.
 *   최종 저장은 호출부가 기존 API(PUT /api/trips/active)로 처리한다.
 *
 * 사용 예
 *   const bg = useBackgroundGeolocation({ onPosition: (c) => appendRoute(c) });
 *   if (bg.isSupported) await bg.start({ tripId });
 *   ...
 *   const route = bg.stop();   // 수집된 좌표 배열 반환
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isNativeRuntime,
  importBackgroundGeolocation,
  importGeolocation,
} from "@/lib/capacitorPlugins";
import type { Coords } from "@/hooks/useAppGeolocation";

export type BgStatus = "unsupported" | "idle" | "tracking" | "denied" | "error";

type Options = {
  /** 좌표를 받을 때마다 호출 */
  onPosition?: (coords: Coords) => void;
  /** 이 거리(m) 이상 움직였을 때만 좌표를 기록 (기본 8m — GPS 튐 제거) */
  distanceFilterM?: number;
  /** 진행 상황을 서버에 동기화하는 주기(ms). 0 이면 동기화 안 함 (기본 60초) */
  syncIntervalMs?: number;
};

/** 두 좌표 사이 거리(m) — Haversine */
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useBackgroundGeolocation(options: Options = {}) {
  const { distanceFilterM = 8, syncIntervalMs = 60_000 } = options;

  const [status, setStatus] = useState<BgStatus>("unsupported");
  const [route, setRoute] = useState<Coords[]>([]);
  const [totalDistanceM, setTotalDistanceM] = useState(0);

  const onPositionRef = useRef(options.onPosition);
  onPositionRef.current = options.onPosition;

  const routeRef = useRef<Coords[]>([]);
  const distanceRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const tripIdRef = useRef<string | null>(null);
  /** 추적 해제 함수 */
  const stopFnRef = useRef<(() => void) | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 지원 여부 판별
  useEffect(() => {
    if (!isNativeRuntime()) {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      const { BackgroundGeolocation } = await importBackgroundGeolocation();
      const { Geolocation } = await importGeolocation();
      if (!cancelled) setStatus(BackgroundGeolocation || Geolocation ? "idle" : "unsupported");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 좌표 1건 수집 — 거리 필터 적용 후 누적 */
  const push = useCallback(
    (coords: Coords) => {
      const prev = routeRef.current[routeRef.current.length - 1];
      if (prev) {
        const d = distanceM(prev, coords);
        if (d < distanceFilterM) return; // 정지 상태의 GPS 튐 무시
        distanceRef.current += d;
        setTotalDistanceM(distanceRef.current);
      }
      routeRef.current = [...routeRef.current, coords];
      setRoute(routeRef.current);
      onPositionRef.current?.(coords);
    },
    [distanceFilterM]
  );

  /** 진행 상황을 기존 API 로 동기화 (통계만 — 좌표는 종료 시 PUT 으로 저장) */
  const syncProgress = useCallback(async () => {
    const tripId = tripIdRef.current;
    if (!tripId) return;
    const startedAt = startedAtRef.current ?? Date.now();
    try {
      await fetch("/api/trips/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tripId,
          distanceM: Math.round(distanceRef.current),
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          points: routeRef.current.length,
        }),
      });
    } catch {
      /* 오프라인 등 — 다음 주기에 다시 시도 */
    }
  }, []);

  /**
   * 추적 시작.
   * @param args.tripId 있으면 syncIntervalMs 주기로 진행 상황을 서버에 동기화한다
   */
  const start = useCallback(
    async (args?: { tripId?: string | null }): Promise<boolean> => {
      if (!isNativeRuntime()) return false;
      if (stopFnRef.current) return true; // 이미 추적 중

      routeRef.current = [];
      distanceRef.current = 0;
      setRoute([]);
      setTotalDistanceM(0);
      startedAtRef.current = Date.now();
      tripIdRef.current = args?.tripId ?? null;

      // 1) 백그라운드 전용 플러그인
      const { BackgroundGeolocation } = await importBackgroundGeolocation();
      if (BackgroundGeolocation) {
        try {
          const watcherId = await BackgroundGeolocation.addWatcher(
            {
              // 안드로이드 알림 — 백그라운드 위치 사용 시 필수(포그라운드 서비스)
              backgroundMessage: "스마트피싱 동선을 기록하는 중입니다.",
              backgroundTitle: "입낚 — 기록 중",
              requestPermissions: true,
              stale: false,
              distanceFilter: distanceFilterM,
            },
            (location: any, error: any) => {
              if (error) {
                // 권한 거부 시 사용자에게 설정 화면을 열어줄 수 있다
                if (error.code === "NOT_AUTHORIZED") setStatus("denied");
                else setStatus("error");
                return;
              }
              if (!location) return;
              push({
                lat: location.latitude,
                lng: location.longitude,
                accuracy: typeof location.accuracy === "number" ? location.accuracy : null,
                altitude: typeof location.altitude === "number" ? location.altitude : null,
                speed: typeof location.speed === "number" ? location.speed : null,
                heading: typeof location.bearing === "number" ? location.bearing : null,
                timestamp: typeof location.time === "number" ? location.time : Date.now(),
              });
            }
          );
          stopFnRef.current = () => {
            void BackgroundGeolocation.removeWatcher({ id: watcherId });
          };
          setStatus("tracking");
          if (syncIntervalMs > 0 && tripIdRef.current) {
            syncTimerRef.current = setInterval(() => void syncProgress(), syncIntervalMs);
          }
          return true;
        } catch {
          setStatus("error");
          return false;
        }
      }

      // 2) 폴백: @capacitor/geolocation watchPosition (포그라운드 한정)
      const { Geolocation } = await importGeolocation();
      if (!Geolocation) {
        setStatus("unsupported");
        return false;
      }
      try {
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== "granted") perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          setStatus("denied");
          return false;
        }
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
          (pos: any, err: any) => {
            if (err || !pos?.coords) return;
            push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
              altitude: pos.coords.altitude ?? null,
              speed: pos.coords.speed ?? null,
              heading: pos.coords.heading ?? null,
              timestamp: pos.timestamp ?? Date.now(),
            });
          }
        );
        stopFnRef.current = () => {
          void Geolocation.clearWatch({ id });
        };
        setStatus("tracking");
        if (syncIntervalMs > 0 && tripIdRef.current) {
          syncTimerRef.current = setInterval(() => void syncProgress(), syncIntervalMs);
        }
        return true;
      } catch {
        setStatus("error");
        return false;
      }
    },
    [distanceFilterM, push, syncIntervalMs, syncProgress]
  );

  /**
   * 추적 정지. 수집된 좌표/거리/경과시간을 반환한다.
   * (최종 저장은 호출부가 기존 PUT /api/trips/active 로 처리)
   */
  const stop = useCallback(() => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setStatus((s) => (s === "tracking" ? "idle" : s));
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    const result = {
      route: routeRef.current,
      distanceM: Math.round(distanceRef.current),
      durationSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
    };
    tripIdRef.current = null;
    return result;
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopFnRef.current?.();
      stopFnRef.current = null;
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  /** 권한 설정 화면 열기 (거부됐을 때 안내용) */
  const openSettings = useCallback(async () => {
    const { BackgroundGeolocation } = await importBackgroundGeolocation();
    try {
      await BackgroundGeolocation?.openSettings();
    } catch {
      /* noop */
    }
  }, []);

  return {
    /** 웹에서는 false — UI 를 숨기면 된다 */
    isSupported: status !== "unsupported",
    status,
    isTracking: status === "tracking",
    route,
    totalDistanceM,
    start,
    stop,
    openSettings,
  };
}
