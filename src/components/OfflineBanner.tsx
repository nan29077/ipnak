"use client";
/**
 * 오프라인 상태 상단 배너
 *
 * - 네트워크가 끊기면 화면 최상단에 고정 배너를 표시한다.
 * - 다시 연결되면 "연결이 복구되었습니다"를 2초간 보여준 뒤 사라진다.
 * - 앱/웹 모두 동작한다 (useNetworkStatus 가 환경에 맞게 감지).
 * - 온라인 상태에서는 아무것도 렌더하지 않으므로 기존 레이아웃에 영향이 없다.
 */
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOffline, wasOffline, clearWasOffline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);

  // 오프라인 → 온라인 복구 시 짧게 안내
  useEffect(() => {
    if (isOffline || !wasOffline) return;
    setShowRestored(true);
    const t = setTimeout(() => {
      setShowRestored(false);
      clearWasOffline();
    }, 2000);
    return () => clearTimeout(t);
    // clearWasOffline 은 매 렌더 새로 생성되므로 의존성에서 제외한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, wasOffline]);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pt-safe fixed inset-x-0 top-0 z-[110] flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-semibold transition-colors"
      style={
        isOffline
          ? { backgroundColor: "#7f1d1d", color: "#fee2e2" }
          : { backgroundColor: "#14532d", color: "#dcfce7" }
      }
    >
      {isOffline ? (
        <>
          <WifiOff size={15} strokeWidth={1.9} />
          <span>인터넷 연결이 끊겼어요. 연결 상태를 확인해 주세요.</span>
        </>
      ) : (
        <>
          <Wifi size={15} strokeWidth={1.9} />
          <span>연결이 복구되었습니다.</span>
        </>
      )}
    </div>
  );
}
