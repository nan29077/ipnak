"use client";
/**
 * 로컬 알림 훅 (기기 자체 예약 알림)
 *
 * 대표 용도: 물때 타이머 — "만조 30분 전" 같은 알림을 서버 없이 기기에서 예약한다.
 * 앱(Capacitor)에서만 동작하고, 웹에서는 모든 함수가 noop 으로 false 를 반환한다.
 *
 * 사용 예
 *   const { scheduleTideAlert, cancel } = useLocalNotifications();
 *   await scheduleTideAlert({ id: 1001, title: "만조 30분 전", body: "지금 출발!", at: date });
 */
import { useCallback, useEffect, useState } from "react";
import { isNativeRuntime, importLocalNotifications } from "@/lib/capacitorPlugins";

export type ScheduleInput = {
  /** 정수 ID — 같은 ID로 다시 예약하면 덮어쓴다 */
  id: number;
  title: string;
  body: string;
  /** 알림 시각 */
  at: Date;
  /** 알림 탭 시 이동할 앱 내 경로 (예: "/map") */
  link?: string;
  /** 추가 데이터 */
  extra?: Record<string, unknown>;
};

/** 물때 알림 ID 대역 — 다른 알림과 충돌하지 않도록 분리 */
export const TIDE_NOTIFICATION_ID_BASE = 10_000;

export function useLocalNotifications() {
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "unsupported">(
    "unknown"
  );

  useEffect(() => {
    if (!isNativeRuntime()) {
      setPermission("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      const { LocalNotifications } = await importLocalNotifications();
      if (!LocalNotifications) {
        if (!cancelled) setPermission("unsupported");
        return;
      }
      try {
        const res = await LocalNotifications.checkPermissions();
        if (!cancelled) setPermission(res.display === "granted" ? "granted" : "denied");
      } catch {
        if (!cancelled) setPermission("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 권한 요청 — 이미 허용됐으면 바로 true */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativeRuntime()) return false;
    const { LocalNotifications } = await importLocalNotifications();
    if (!LocalNotifications) return false;
    try {
      let res = await LocalNotifications.checkPermissions();
      if (res.display !== "granted") res = await LocalNotifications.requestPermissions();
      const ok = res.display === "granted";
      setPermission(ok ? "granted" : "denied");
      return ok;
    } catch {
      setPermission("denied");
      return false;
    }
  }, []);

  /** 알림 1건 예약. 성공 시 true */
  const schedule = useCallback(
    async (input: ScheduleInput): Promise<boolean> => {
      if (!isNativeRuntime()) return false;
      // 과거 시각은 즉시 발송되어 사용자를 혼란시키므로 무시한다
      if (input.at.getTime() <= Date.now()) return false;

      const { LocalNotifications } = await importLocalNotifications();
      if (!LocalNotifications) return false;
      try {
        const res = await LocalNotifications.checkPermissions();
        if (res.display !== "granted") {
          const granted = await requestPermission();
          if (!granted) return false;
        }
        await LocalNotifications.schedule({
          notifications: [
            {
              id: input.id,
              title: input.title,
              body: input.body,
              schedule: { at: input.at, allowWhileIdle: true },
              extra: { link: input.link ?? null, ...(input.extra ?? {}) },
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    },
    [requestPermission]
  );

  /**
   * 물때 알림 예약 — 지정 시각(만조/간조)에서 minutesBefore 분 전에 알린다.
   * @returns 예약 성공 여부
   */
  const scheduleTideAlert = useCallback(
    async (input: {
      /** 물때 슬롯 번호 (0~) — TIDE_NOTIFICATION_ID_BASE 에 더해 ID로 쓴다 */
      slot: number;
      /** 만조/간조 시각 */
      tideAt: Date;
      /** 몇 분 전에 알릴지 (기본 30분) */
      minutesBefore?: number;
      title: string;
      body: string;
      link?: string;
    }): Promise<boolean> => {
      const before = input.minutesBefore ?? 30;
      const at = new Date(input.tideAt.getTime() - before * 60_000);
      return schedule({
        id: TIDE_NOTIFICATION_ID_BASE + input.slot,
        title: input.title,
        body: input.body,
        at,
        link: input.link,
        extra: { kind: "tide", tideAt: input.tideAt.toISOString(), minutesBefore: before },
      });
    },
    [schedule]
  );

  /** 특정 ID 알림 취소 */
  const cancel = useCallback(async (ids: number[]): Promise<boolean> => {
    if (!isNativeRuntime() || ids.length === 0) return false;
    const { LocalNotifications } = await importLocalNotifications();
    if (!LocalNotifications) return false;
    try {
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
      return true;
    } catch {
      return false;
    }
  }, []);

  /** 예약된 물때 알림 전체 취소 */
  const cancelAllTideAlerts = useCallback(async (): Promise<boolean> => {
    if (!isNativeRuntime()) return false;
    const { LocalNotifications } = await importLocalNotifications();
    if (!LocalNotifications) return false;
    try {
      const pending = await LocalNotifications.getPending();
      const ids = (pending?.notifications ?? [])
        .map((n: { id: number }) => n.id)
        .filter((id: number) => id >= TIDE_NOTIFICATION_ID_BASE);
      if (ids.length === 0) return true;
      await LocalNotifications.cancel({ notifications: ids.map((id: number) => ({ id })) });
      return true;
    } catch {
      return false;
    }
  }, []);

  /** 예약 목록 조회 */
  const getPending = useCallback(async (): Promise<{ id: number; title?: string }[]> => {
    if (!isNativeRuntime()) return [];
    const { LocalNotifications } = await importLocalNotifications();
    if (!LocalNotifications) return [];
    try {
      const res = await LocalNotifications.getPending();
      return res?.notifications ?? [];
    } catch {
      return [];
    }
  }, []);

  return {
    /** "unsupported" 면 웹 — 호출부에서 UI 를 숨기면 된다 */
    permission,
    isSupported: permission !== "unsupported",
    requestPermission,
    schedule,
    scheduleTideAlert,
    cancel,
    cancelAllTideAlerts,
    getPending,
  };
}
