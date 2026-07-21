"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 낚시단 유료 포인트 개설 스위치
// ON: 낚시단 개설 10,000P 차감 · 가입 신청 시 1,000P 차감(승인 시 단장 500P 적립, 거절 시 환불)
// OFF: 낚시단 무료 개설 · 가입 신청 시 포인트 차감 없음
export function GroupPointsToggle({ initial }: { initial: boolean }) {
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
        body: JSON.stringify({ type: "SETTING_SET", key: "group_points_required", value: next ? "true" : "false" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(next ? "낚시단 유료 개설을 켰습니다" : "낚시단 무료 개설로 전환했습니다", "success");
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
          <h2 className="text-[15px] font-bold text-navy-800">낚시단 유료 포인트 개설</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 낚시단 개설 시 <b className="text-navy-600">10,000P</b> 차감, 가입 신청 시 <b className="text-navy-600">1,000P</b> 차감(승인 시 단장 500P 적립, 거절 시 환불).<br />
            OFF: 낚시단을 무료로 개설하고, 가입 신청 시에도 포인트 차감 없이 승인 요청할 수 있습니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="낚시단 유료 포인트 개설"
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
          <><Users size={16} className="text-amber-500" /> 현재: <span className="text-amber-500">유료 개설 (포인트 차감)</span></>
        ) : (
          <><Users size={16} className="text-navy-300" /> 현재: <span className="text-navy-400">무료 개설</span></>
        )}
      </div>
    </div>
  );
}
