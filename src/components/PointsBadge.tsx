"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

// 헤더 우측 알림 옆 보유 포인트 표시.
// 포인트 기능이 활성화(points_enabled=true)면 잔액이 0이어도 "0P"로 항상 표시한다.
// 서버에서 내려준 initialEnabled 가 캐시로 오래됐을 수 있으므로,
// 마운트 시 /api/points/balance 의 enabled 로 표시 여부를 스스로 보정한다.
// 색상/배경은 Tailwind 불투명도 변형(JIT) 누락에 영향받지 않도록 인라인 스타일로 지정.
export function PointsBadge({ initial, initialEnabled }: { initial: number; initialEnabled: boolean }) {
  const [points, setPoints] = useState(initial);
  const [enabled, setEnabled] = useState(initialEnabled);

  async function refresh() {
    try {
      const res = await fetch("/api/points/balance", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.balance === "number") setPoints(data.balance);
      if (typeof data.enabled === "boolean") setEnabled(data.enabled);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("points:changed", onChange);
    return () => window.removeEventListener("points:changed", onChange);
  }, []);

  if (!enabled) return null;

  return (
    <Link
      href="/me/points"
      aria-label={`보유 포인트 ${points.toLocaleString()}P`}
      title="포인트 관리로 이동"
      className="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 transition-transform hover:scale-[1.03] active:scale-95"
      style={{
        backgroundColor: "rgba(249, 115, 22, 0.14)",
        boxShadow: "inset 0 0 0 1px rgba(249, 115, 22, 0.28)",
      }}
    >
      <Coins size={15} strokeWidth={2} style={{ color: "#fb8b3c" }} />
      <span className="text-[13px] font-extrabold tabular-nums leading-none" style={{ color: "#fb8b3c" }}>
        {points.toLocaleString()}
      </span>
      <span className="text-[11px] font-bold leading-none" style={{ color: "rgba(251, 139, 60, 0.75)" }}>
        P
      </span>
    </Link>
  );
}

// 포인트 변동을 헤더에 알리는 헬퍼
export function notifyPointsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("points:changed"));
}
