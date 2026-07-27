"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

// status 흐름: pending → confirmed → shipped → delivered
const STATUS_FLOW: Record<string, { label: string; nextStatus: string; nextLabel: string }> = {
  pending:   { label: "결제완료",  nextStatus: "confirmed", nextLabel: "배송준비 처리" },
  confirmed: { label: "배송준비",  nextStatus: "shipped",   nextLabel: "배송중 처리" },
  shipped:   { label: "배송중",    nextStatus: "delivered", nextLabel: "배송완료 처리" },
  delivered: { label: "배송완료",  nextStatus: "",          nextLabel: "" },
  cancelled: { label: "취소",      nextStatus: "",          nextLabel: "" },
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-400/15 text-amber-400",
  confirmed: "bg-blue-400/15 text-blue-400",
  shipped:   "bg-aqua-400/15 text-aqua-400",
  delivered: "bg-green-400/15 text-green-400",
  cancelled: "bg-red-400/15 text-red-400",
};

export function IpnakBallOrderStatusBadge({ status }: { status: string }) {
  const s = STATUS_FLOW[status];
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[status] ?? "bg-navy-100/20 text-navy-400"}`}
    >
      {s?.label ?? status}
    </span>
  );
}

export function IpnakBallOrderActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const flow = STATUS_FLOW[status];
  if (!flow?.nextStatus) {
    return <span className="text-xs text-navy-400">-</span>;
  }

  async function advance() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ipnak-ball/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: flow.nextStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "오류");
      toast(`${flow.nextLabel} 완료`, "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={advance}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/25 disabled:opacity-50"
    >
      {loading && <Loader2 size={11} className="animate-spin" />}
      {flow.nextLabel}
    </button>
  );
}
