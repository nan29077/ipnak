"use client";
import { useEffect, useRef, useState } from "react";
import { fetchWalkingLocationLabel } from "@/lib/walkingLocationClient";

/**
 * 잠긴 워킹 피드의 GPS 기반 수계명 배지 — "OO강 인근"
 *
 * 썸네일 그리드 / 리스트 카드 / 상세 잠금 화면에서 공통으로 쓴다.
 * 라벨이 없거나 조회 실패면 아무것도 렌더링하지 않는다 (빈 자리 생기지 않게).
 */

/** 라인형 위치 핀 (인라인 SVG) */
function PinIcon({ size }: { size: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0" aria-hidden
    >
      <path d="M20 10c0 5.25-8 12-8 12s-8-6.75-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * 수계명 조회 — 서버가 내려준 캐시(locationLabel)가 있으면 그대로 쓰고,
 * 없을 때만 잠금 상태에서 한 번 조회한다. (조회는 walkingLocationClient 가 직렬화)
 */
export function useWaterBodyLabel(postId: string, initial: string | null | undefined, enabled: boolean) {
  const [label, setLabel] = useState<string | null>(initial ?? null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || label || fetchedRef.current) return;
    fetchedRef.current = true;
    let alive = true;
    fetchWalkingLocationLabel(postId)
      .then((v) => { if (alive && v) setLabel(v); })
      .catch(() => { /* 조회 실패 시 표시 생략 */ });
    return () => { alive = false; };
  }, [enabled, label, postId]);

  return label;
}

/** sm: 썸네일 그리드(1/3 폭) / md: 리스트 카드·상세 잠금 화면 */
export function WaterBodyBadge({ label, size = "md" }: { label: string | null; size?: "sm" | "md" }) {
  if (!label) return null;
  const sm = size === "sm";
  return (
    <span
      className={
        sm
          ? "inline-flex max-w-full items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm"
          : "inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur-sm"
      }
    >
      <PinIcon size={sm ? 9 : 14} />
      <span className="truncate">{label} 인근</span>
    </span>
  );
}
