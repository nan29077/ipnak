"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Store } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 쇼핑 메뉴 노출 스위치: ON=쇼핑 노출 / OFF=중고피싱 노출
export function ShopToggle({ initial }: { initial: boolean }) {
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SETTING_SET", key: "shop_menu_enabled", value: next ? "true" : "false" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(next ? "쇼핑 메뉴를 노출합니다" : "중고피싱 메뉴를 노출합니다", "success");
      router.refresh();
    } catch (e: any) {
      setOn(!next);
      toast(e.message, "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-navy-800">쇼핑 메뉴 노출</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 사용자 앱 네비게이션에 <b className="text-navy-600">쇼핑</b> 메뉴가 노출됩니다.<br />
            OFF: 같은 자리에 <b className="text-navy-600">중고피싱</b> 메뉴가 대신 노출됩니다.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="쇼핑 메뉴 노출"
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
            on ? "bg-orange-500" : "bg-navy-200"
          )}
        >
          <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-2.5 text-[13px] font-semibold">
        {loading ? (
          <><Loader2 size={16} className="animate-spin text-orange-500" /> 저장 중...</>
        ) : on ? (
          <><ShoppingBag size={16} className="text-orange-500" /> 현재 노출 메뉴: <span className="text-orange-500">쇼핑</span></>
        ) : (
          <><Store size={16} className="text-aqua-500" /> 현재 노출 메뉴: <span className="text-aqua-500">중고피싱</span></>
        )}
      </div>
    </div>
  );
}
