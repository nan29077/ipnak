"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Coins } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 포인트 기능 사용 스위치
// ON: 포인트 적립/사용, 워킹 피드 잠금, 충전·선물, 헤더 포인트 표시 전체 활성화
// OFF: 포인트 제도 전체 비활성화 (워킹 피드 잠금 해제, 헤더 포인트 숨김)
export function PointsToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !on;
    setLoading(true);
    setOn(next);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SETTING_SET", key: "points_enabled", value: next ? "true" : "false" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(next ? "포인트 제도를 활성화했습니다" : "포인트 제도를 비활성화했습니다", "success");
      router.refresh();
    } catch (e: any) {
      setOn(!next);
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-navy-800">포인트 기능 사용</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 포인트 <b className="text-navy-600">적립·사용</b>, 워킹 피드 잠금(200P 열람), 충전·선물, 헤더 포인트 표시가 모두 활성화됩니다.<br />
            OFF: 포인트 제도가 전체 비활성화되어 워킹 피드 잠금이 풀리고 헤더 포인트가 숨겨집니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="포인트 기능 사용"
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
            on ? "bg-amber-400" : "bg-navy-200",
          )}
        >
          <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-2.5 text-[13px] font-semibold">
        {loading ? (
          <><Loader2 size={16} className="animate-spin text-amber-500" /> 저장 중...</>
        ) : on ? (
          <><Coins size={16} className="text-amber-500" /> 현재: <span className="text-amber-500">포인트 제도 활성화</span></>
        ) : (
          <><Coins size={16} className="text-navy-300" /> 현재: <span className="text-navy-400">포인트 제도 비활성화</span></>
        )}
      </div>
    </div>
  );
}
