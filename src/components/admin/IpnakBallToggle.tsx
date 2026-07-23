"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export function IpnakBallToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [loading, setLoading] = useState(false);
  async function toggle() {
    const next = !on; setOn(next); setLoading(true);
    try {
      const res = await fetch("/api/admin/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "SETTING_SET", key: "ipnak_ball_enabled", value: String(next) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      toast(next ? "입낚볼 판매를 활성화했습니다" : "입낚볼 판매를 비활성화했습니다", "success");
      router.refresh();
    } catch (e: any) { setOn(!next); toast(e.message, "error"); }
    finally { setLoading(false); }
  }
  return <div className="card p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-[15px] font-bold text-navy-800">입낚볼 구매 기능</h2><p className="mt-1 text-[13px] leading-relaxed text-navy-400">켜면 낚시꾼 마이페이지에 입낚볼 구매 카드와 버튼이 표시됩니다. 끄면 즉시 숨겨집니다.</p></div><button onClick={toggle} disabled={loading} role="switch" aria-checked={on} aria-label="입낚볼 구매 기능" className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", on ? "bg-orange-500" : "bg-navy-200")}><span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} /></button></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-2.5 text-[13px] font-semibold">{loading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} className={on ? "text-orange-500" : "text-navy-300"} />} 현재: <span className={on ? "text-orange-500" : "text-navy-400"}>{on ? "판매 활성화" : "판매 비활성화"}</span></div></div>;
}
