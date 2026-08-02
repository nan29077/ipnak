"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

/** 종료된 대회의 1/2/3위에게 보상 포인트를 지급한다(대회당 1회). */
export function PayRewardsButton({ tournamentId, title, rewards }: {
  tournamentId: string;
  title: string;
  rewards: (number | null)[];
}) {
  const router = useRouter();
  const toast = useToast();
  const doConfirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const summary = rewards
    .map((r, i) => (r && r > 0 ? `${i + 1}위 ${r.toLocaleString()}P` : null))
    .filter(Boolean)
    .join(" · ");

  async function run() {
    const ok = await doConfirm({
      title: `"${title}" 보상을 지급할까요?`,
      message: `${summary} — 지급 후에는 취소할 수 없습니다.`,
      confirmLabel: "지급",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/pay-rewards`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(`보상 ${Number(data.total ?? 0).toLocaleString()}P를 지급했습니다`, "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={run} disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold btn-press transition-colors outline-none focus-visible:ring-2 focus-visible:ring-aqua-300 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        "bg-orange-500 text-white shadow-soft hover:bg-orange-600",
      )}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} strokeWidth={1.8} />} 보상 지급
    </button>
  );
}
