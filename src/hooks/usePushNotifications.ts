"use client";
/**
 * 푸시 알림 훅 (FCM / APNs)
 *
 * 앱(Capacitor)에서만 동작한다.
 * - 권한 요청 → register() → FCM 토큰 수신
 * - 받은 토큰을 POST /api/notifications/register-token 으로 서버에 저장
 * - 알림 수신(pushNotificationReceived) / 탭(pushNotificationActionPerformed) 처리
 *
 * 웹에서는 아무것도 하지 않는다 (noop). 상태값만 "unsupported" 로 유지되므로
 * 기존 웹 화면에 어떤 영향도 없다.
 *
 * 사용 예
 *   const { status, token } = usePushNotifications({
 *     enabled: !!user,
 *     onNotificationTap: (data) => { if (data.link) router.push(data.link); },
 *   });
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isNativeRuntime,
  getNativePlatform,
  importPushNotifications,
} from "@/lib/capacitorPlugins";

export type PushStatus =
  | "idle"          // 아직 시작 안 함
  | "unsupported"   // 웹 등 지원하지 않는 환경
  | "denied"        // 사용자가 권한 거부
  | "registering"   // 등록 진행 중
  | "registered"    // 토큰 발급 + 서버 저장 완료
  | "error";

export type PushPayload = {
  title?: string;
  body?: string;
  /** data 페이로드 (딥링크 등) */
  data: Record<string, any>;
  /** data.link 를 편의상 꺼내둔 값 */
  link?: string;
};

type Options = {
  /** false 면 아무 작업도 하지 않는다 (로그인 전 등) */
  enabled?: boolean;
  /** 앱이 열려 있는 상태에서 알림이 도착했을 때 */
  onNotificationReceived?: (payload: PushPayload) => void;
  /** 사용자가 알림을 탭해서 앱이 열렸을 때 */
  onNotificationTap?: (payload: PushPayload) => void;
};

/** 서버에 토큰 저장 — 실패해도 앱 동작을 막지 않는다 */
async function registerTokenOnServer(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: getNativePlatform() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 로그아웃 등에서 토큰을 서버에서 지울 때 사용 */
export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await fetch("/api/notifications/register-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* noop */
  }
}

export function usePushNotifications(options: Options = {}) {
  const { enabled = true, onNotificationReceived, onNotificationTap } = options;
  const [status, setStatus] = useState<PushStatus>("idle");
  const [token, setToken] = useState<string | null>(null);

  // 콜백을 ref 로 잡아두어 리스너를 재등록하지 않는다
  const receivedRef = useRef(onNotificationReceived);
  const tapRef = useRef(onNotificationTap);
  receivedRef.current = onNotificationReceived;
  tapRef.current = onNotificationTap;

  useEffect(() => {
    if (!enabled) return;
    if (!isNativeRuntime()) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    // 언마운트 시 제거할 리스너 핸들 목록
    const handles: { remove: () => Promise<void> | void }[] = [];

    (async () => {
      const { PushNotifications } = await importPushNotifications();
      if (!PushNotifications || cancelled) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        setStatus("registering");

        // 이미 허용된 상태면 다시 묻지 않는다
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (cancelled) return;
        if (perm.receive !== "granted") {
          setStatus("denied");
          return;
        }

        // 토큰 수신
        handles.push(
          await PushNotifications.addListener("registration", (t: { value: string }) => {
            if (cancelled) return;
            setToken(t.value);
            void registerTokenOnServer(t.value).then((ok) => {
              if (!cancelled) setStatus(ok ? "registered" : "error");
            });
          })
        );

        handles.push(
          await PushNotifications.addListener("registrationError", () => {
            if (!cancelled) setStatus("error");
          })
        );

        // 포그라운드 수신
        handles.push(
          await PushNotifications.addListener(
            "pushNotificationReceived",
            (n: { title?: string; body?: string; data?: Record<string, any> }) => {
              const data = n.data ?? {};
              receivedRef.current?.({
                title: n.title,
                body: n.body,
                data,
                link: typeof data.link === "string" ? data.link : undefined,
              });
            }
          )
        );

        // 알림 탭
        handles.push(
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action: {
              notification?: { title?: string; body?: string; data?: Record<string, any> };
            }) => {
              const n = action.notification ?? {};
              const data = n.data ?? {};
              tapRef.current?.({
                title: n.title,
                body: n.body,
                data,
                link: typeof data.link === "string" ? data.link : undefined,
              });
            }
          )
        );

        await PushNotifications.register();
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => {
        try {
          void h.remove();
        } catch {
          /* noop */
        }
      });
    };
  }, [enabled]);

  /** 배지/알림 목록 초기화 (앱이 포그라운드로 올라올 때 호출) */
  const clearDelivered = useCallback(async () => {
    if (!isNativeRuntime()) return;
    const { PushNotifications } = await importPushNotifications();
    try {
      await PushNotifications?.removeAllDeliveredNotifications();
    } catch {
      /* noop */
    }
  }, []);

  return { status, token, clearDelivered, isSupported: status !== "unsupported" };
}
