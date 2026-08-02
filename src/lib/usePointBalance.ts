"use client";
import { useCallback, useEffect, useState } from "react";

export type PointBalance = { enabled: boolean; balance: number };

/**
 * 결제 화면의 "포인트 사용" 필드용 보유 포인트 조회 훅.
 * - active 가 true 로 바뀔 때(=결제 시트가 열릴 때) 1회 조회한다.
 * - 비로그인(401)·포인트 제도 OFF·조회 실패는 모두 { enabled: false, balance: 0 } 으로 취급해
 *   포인트 사용 UI 자체를 숨긴다.
 */
export function usePointBalance(active: boolean): PointBalance & { reload: () => void } {
  const [state, setState] = useState<PointBalance>({ enabled: false, balance: 0 });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/points/balance");
      if (!res.ok) { setState({ enabled: false, balance: 0 }); return; }
      const data = await res.json();
      setState({ enabled: Boolean(data?.enabled), balance: Number(data?.balance) || 0 });
    } catch {
      setState({ enabled: false, balance: 0 });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [active, load]);

  return { ...state, reload: load };
}

/** 입력값을 0 이상의 정수로, 보유 포인트·결제금액 이내로 클램프한다(서버에서도 동일하게 재검증). */
export function clampUsablePoints(raw: string | number, balance: number, totalAmount: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(n, Math.max(0, balance), Math.max(0, Math.floor(totalAmount))));
}
