"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 예약 기능 활성화 스위치
// ON: 예약 메뉴·페이지가 정상 동작
// OFF: 예약 메뉴 진입 시 "서비스 준비 중" 페이지 표시
export function ReservationToggle({ initial }: { initial: boolean }) {
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
          key: "reservation_enabled",
          value: next ? "true" : "false",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(
        next
          ? "예약 기능을 활성화했습니다"
          : "예약 기능을 비활성화했습니다 (서비스 준비 중 표시)",
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
          <h2 className="text-[15px] font-bold text-navy-800">예약 기능 활성화</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 낚시배·펜션·유료터 등 <b className="text-navy-600">예약 기능이 정상 동작</b>합니다.<br />
            OFF: 예약 메뉴 클릭 시{" "}
            <b className="text-navy-600">"서비스 준비 중입니다."</b> 페이지가 표시됩니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="예약 기능 활성화"
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
            <CalendarDays size={16} className="text-orange-500" />
            예약 상태: <span className="text-orange-500">활성화 (정상 운영 중)</span>
          </>
        ) : (
          <>
            <CalendarDays size={16} className="text-navy-300" />
            예약 상태:{" "}
            <span className="text-navy-400">비활성화 (서비스 준비 중)</span>
          </>
        )}
      </div>
    </div>
  );
}
