"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Fish } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 배스낚시 전용 모드 스위치
// ON: 앱 전체에서 배스(Largemouth Bass) 관련 콘텐츠만 표시
// OFF: 전체 어종 기능 활성화
export function BassOnlyToggle({ initial }: { initial: boolean }) {
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
          key: "bass_only_mode",
          value: next ? "true" : "false",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(
        next
          ? "배스낚시 전용 모드를 활성화했습니다"
          : "전체 어종 모드로 복구했습니다",
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
          <h2 className="text-[15px] font-bold text-navy-800">배스낚시 전용 모드</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 앱 전체에서 <b className="text-navy-600">배스(Largemouth Bass)</b> 관련 콘텐츠만 표시합니다.<br />
            다른 어종의 기록·검색·목록이 모두 숨겨지고 배스 관련 낚시터·용품만 노출됩니다.<br />
            OFF: 기존 전체 어종 기능이 활성화됩니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="배스낚시 전용 모드"
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
            on ? "bg-orange-500" : "bg-navy-200"
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
            <Loader2 size={16} className="animate-spin text-orange-500" /> 저장 중...
          </>
        ) : on ? (
          <>
            <Fish size={16} className="text-orange-500" />
            현재 모드:{" "}
            <span className="text-orange-500">배스낚시 전용 (배스만 표시)</span>
          </>
        ) : (
          <>
            <Fish size={16} className="text-aqua-500" />
            현재 모드: <span className="text-aqua-500">전체 어종</span>
          </>
        )}
      </div>
    </div>
  );
}
