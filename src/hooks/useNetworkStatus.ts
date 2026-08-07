"use client";
/**
 * 네트워크 연결 상태 훅
 *
 * - 앱(Capacitor): @capacitor/network — Wi-Fi/셀룰러 구분까지 제공
 * - 웹: navigator.onLine + online/offline 이벤트 (기존 웹 표준 그대로)
 *
 * 초기값은 항상 "연결됨"으로 둔다. SSR/첫 렌더에서 offline 로 잘못 판단해
 * 배너가 깜빡이는 것을 막기 위함이다.
 *
 * 사용 예
 *   const { isOnline, connectionType } = useNetworkStatus();
 */
import { useEffect, useState } from "react";
import { isNativeRuntime, importNetwork } from "@/lib/capacitorPlugins";

export type ConnectionType = "wifi" | "cellular" | "none" | "unknown";

export function useNetworkStatus() {
  // 낙관적 초기값 — 실제 상태는 마운트 직후 갱신된다
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>("unknown");
  /** 한 번이라도 오프라인이 됐다가 복구됐는지 (재조회 트리거용) */
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let removeNative: (() => void) | null = null;

    const apply = (online: boolean, type: ConnectionType) => {
      if (cancelled) return;
      setIsOnline((prev) => {
        if (prev && !online) setWasOffline(true);
        return online;
      });
      setConnectionType(type);
    };

    (async () => {
      // 앱: 네이티브 네트워크 상태
      if (isNativeRuntime()) {
        const { Network } = await importNetwork();
        if (Network && !cancelled) {
          try {
            const st = await Network.getStatus();
            apply(st.connected, (st.connectionType as ConnectionType) ?? "unknown");
            const handle = await Network.addListener(
              "networkStatusChange",
              (st2: { connected: boolean; connectionType: string }) => {
                apply(st2.connected, (st2.connectionType as ConnectionType) ?? "unknown");
              }
            );
            removeNative = () => {
              try {
                void handle.remove();
              } catch {
                /* noop */
              }
            };
            return;
          } catch {
            // 실패 시 아래 웹 경로로 폴백
          }
        }
      }

      // 웹 (기존 표준)
      if (typeof navigator === "undefined") return;
      apply(navigator.onLine !== false, navigator.onLine === false ? "none" : "unknown");
    })();

    // 웹 이벤트는 앱에서도 함께 붙여둔다 (WebView 자체 이벤트도 신뢰 가능)
    const onOnline = () => apply(true, "unknown");
    const onOffline = () => apply(false, "none");
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }

    return () => {
      cancelled = true;
      removeNative?.();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType,
    wasOffline,
    /** 복구 후 재조회를 한 번 처리했으면 호출해 플래그를 내린다 */
    clearWasOffline: () => setWasOffline(false),
  };
}
