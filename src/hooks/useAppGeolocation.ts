"use client";
/**
 * GPS 위치 훅 (앱/웹 통합)
 *
 * - 앱(Capacitor): @capacitor/geolocation — 네이티브 위치 서비스라 정확도가 높고
 *   권한 처리·배터리 최적화가 OS 수준에서 이뤄진다.
 * - 웹: 기존 navigator.geolocation 그대로 사용 (기존 GPS 로직과 동일한 동작)
 *
 * 반환 좌표 형태는 기존 코드에서 쓰는 { lat, lng, accuracy } 를 따른다.
 * 이 훅은 새 파일이며 기존 GPS 사용처(MapScreen, RecordingProvider 등)를 수정하지 않는다.
 *
 * 사용 예
 *   const { getCurrentPosition, watch, clearWatch } = useAppGeolocation();
 *   const pos = await getCurrentPosition();   // { lat, lng, accuracy } | null
 */
import { useCallback, useEffect, useRef } from "react";
import { isNativeRuntime, importGeolocation } from "@/lib/capacitorPlugins";

export type Coords = {
  lat: number;
  lng: number;
  /** 정확도 (m) */
  accuracy: number | null;
  /** 고도 (m) — 없으면 null */
  altitude?: number | null;
  /** 속도 (m/s) — 없으면 null */
  speed?: number | null;
  /** 진행 방향 (deg) — 없으면 null */
  heading?: number | null;
  /** 측정 시각 (ms) */
  timestamp: number;
};

export type GeoOptions = {
  /** 고정확도 모드 (기본 true) */
  enableHighAccuracy?: boolean;
  /** 타임아웃 (ms, 기본 15000) */
  timeout?: number;
  /** 캐시 허용 시간 (ms, 기본 0 = 항상 새로 측정) */
  maximumAge?: number;
};

const DEFAULTS: Required<GeoOptions> = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

/** Capacitor / Web 어느 쪽 결과든 Coords 로 정규화 */
function normalize(p: any): Coords | null {
  const c = p?.coords;
  if (!c || typeof c.latitude !== "number" || typeof c.longitude !== "number") return null;
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: typeof c.accuracy === "number" ? c.accuracy : null,
    altitude: typeof c.altitude === "number" ? c.altitude : null,
    speed: typeof c.speed === "number" ? c.speed : null,
    heading: typeof c.heading === "number" ? c.heading : null,
    timestamp: typeof p.timestamp === "number" ? p.timestamp : Date.now(),
  };
}

/** 앱/웹 공통 단발 위치 조회 — 실패 시 null (throw 하지 않는다) */
export async function getCurrentCoords(options: GeoOptions = {}): Promise<Coords | null> {
  const opt = { ...DEFAULTS, ...options };

  // 앱: 네이티브 위치
  if (isNativeRuntime()) {
    const { Geolocation } = await importGeolocation();
    if (Geolocation) {
      try {
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          perm = await Geolocation.requestPermissions();
        }
        if (perm.location === "granted" || perm.coarseLocation === "granted") {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: opt.enableHighAccuracy,
            timeout: opt.timeout,
            maximumAge: opt.maximumAge,
          });
          const c = normalize(pos);
          if (c) return c;
        }
      } catch {
        // 네이티브 실패 시 아래 웹 경로로 폴백
      }
    }
  }

  // 웹 (기존 동작)
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise<Coords | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(normalize(pos)),
      () => resolve(null),
      {
        enableHighAccuracy: opt.enableHighAccuracy,
        timeout: opt.timeout,
        maximumAge: opt.maximumAge,
      }
    );
  });
}

export function useAppGeolocation() {
  /** watch 해제 함수들 — 언마운트 시 모두 정리 */
  const watchersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const watchers = watchersRef.current;
    return () => {
      watchers.forEach((clear) => {
        try {
          clear();
        } catch {
          /* noop */
        }
      });
      watchers.clear();
    };
  }, []);

  const getCurrentPosition = useCallback(
    (options?: GeoOptions) => getCurrentCoords(options),
    []
  );

  /**
   * 위치 변화 구독. 반환된 문자열을 clearWatch() 에 넘겨 해제한다.
   * (앱/웹 모두 같은 인터페이스)
   */
  const watch = useCallback(
    async (
      onPosition: (coords: Coords) => void,
      options?: GeoOptions & { onError?: () => void }
    ): Promise<string | null> => {
      const opt = { ...DEFAULTS, ...options };
      const key = `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 앱: 네이티브 watchPosition
      if (isNativeRuntime()) {
        const { Geolocation } = await importGeolocation();
        if (Geolocation) {
          try {
            let perm = await Geolocation.checkPermissions();
            if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
              perm = await Geolocation.requestPermissions();
            }
            if (perm.location === "granted" || perm.coarseLocation === "granted") {
              const id = await Geolocation.watchPosition(
                {
                  enableHighAccuracy: opt.enableHighAccuracy,
                  timeout: opt.timeout,
                  maximumAge: opt.maximumAge,
                },
                (pos: any, err: any) => {
                  if (err) {
                    options?.onError?.();
                    return;
                  }
                  const c = normalize(pos);
                  if (c) onPosition(c);
                }
              );
              watchersRef.current.set(key, () => {
                void Geolocation.clearWatch({ id });
              });
              return key;
            }
          } catch {
            /* 웹 폴백으로 진행 */
          }
        }
      }

      // 웹 (기존 동작)
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const c = normalize(pos);
          if (c) onPosition(c);
        },
        () => options?.onError?.(),
        {
          enableHighAccuracy: opt.enableHighAccuracy,
          timeout: opt.timeout,
          maximumAge: opt.maximumAge,
        }
      );
      watchersRef.current.set(key, () => navigator.geolocation.clearWatch(id));
      return key;
    },
    []
  );

  const clearWatch = useCallback((key: string | null) => {
    if (!key) return;
    const clear = watchersRef.current.get(key);
    if (!clear) return;
    try {
      clear();
    } catch {
      /* noop */
    }
    watchersRef.current.delete(key);
  }, []);

  return {
    /** 앱이면 네이티브 위치, 웹이면 navigator.geolocation */
    isNative: isNativeRuntime(),
    getCurrentPosition,
    watch,
    clearWatch,
  };
}
