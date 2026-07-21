"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Route } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 워킹 피드 노출 스위치
// ON: 메인 페이지에 워킹 피드 섹션 표시 (데이터피싱 동선 기록)
// OFF: 워킹 피드 섹션 숨김
export function WalkingFeedToggle({ initial }: { initial: boolean }) {
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
        body: JSON.stringify({
          type: "SETTING_SET",
          key: "walking_feed_enabled",
          value: next ? "true" : "false",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(
        next ? "워킹 피드를 메인에 노출합니다" : "워킹 피드를 숨겼습니다",
        "success"
      );
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
          <h2 className="text-[15px] font-bold text-navy-800">워킹 피드 노출</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 메인 페이지에 <b className="text-navy-600">워킹 피드</b> 섹션을 표시합니다.<br />
            데이터피싱 동선 기록(지도 썸네일)이 메인에 노출됩니다.<br />
            OFF: 워킹 피드 섹션이 메인 페이지에서 완전히 숨겨집니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="워킹 피드 노출"
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
            on ? "bg-aqua-500" : "bg-navy-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              on ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-2.5 text-[13px] font-semibold">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin text-aqua-500" /> 저장 중...
          </>
        ) : on ? (
          <>
            <Route size={16} className="text-aqua-500" />
            현재: <span className="text-aqua-500">워킹 피드 노출 중</span>
          </>
        ) : (
          <>
            <Route size={16} className="text-navy-300" />
            현재: <span className="text-navy-400">워킹 피드 숨김</span>
          </>
        )}
      </div>
    </div>
  );
}
