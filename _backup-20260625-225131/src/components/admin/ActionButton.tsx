"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export function ActionButton({
  payload, label, variant = "default", confirm, successMsg,
}: {
  payload: Record<string, any>; label: string;
  variant?: "default" | "primary" | "danger" | "ghost"; confirm?: string; successMsg?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(successMsg || "처리되었습니다", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const cls = {
    default: "bg-navy-50 text-navy-700 hover:bg-navy-100",
    primary: "bg-navy-700 text-white shadow-soft hover:bg-navy-800",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    ghost: "text-navy-400 hover:bg-navy-50",
  }[variant];

  return (
    <button onClick={run} disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold btn-press transition-colors outline-none focus-visible:ring-2 focus-visible:ring-aqua-300 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        cls
      )}>
      {loading && <Loader2 size={12} className="animate-spin" />} {label}
    </button>
  );
}
