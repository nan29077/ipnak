"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, DatabaseZap } from "lucide-react";
import { useToast } from "@/components/Toast";

export function MarketSeedButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function run() {
    if (!window.confirm("기존 중고피싱 데이터를 모두 삭제하고 더미 데이터 20개를 새로 생성합니다. 계속하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seed-market", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      toast(data.message || "더미 데이터 생성 완료", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-[13px] font-semibold text-white shadow-soft hover:bg-orange-600 active:scale-[0.97] disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <DatabaseZap size={14} />}
      더미 데이터 생성
    </button>
  );
}
