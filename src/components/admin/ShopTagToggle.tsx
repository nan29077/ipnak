"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag, XCircle } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// 쇼핑 태그 스위치: ON=피드·조행기에서 상품 태그 활성화 / OFF=상품 태그 비활성화
export function ShopTagToggle({ initial }: { initial: boolean }) {
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
          key: "shop_tag_enabled",
          value: next ? "true" : "false",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(next ? "쇼핑 태그를 활성화했습니다" : "쇼핑 태그를 비활성화했습니다", "success");
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
          <h2 className="text-[15px] font-bold text-navy-800">쇼핑 태그</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            ON: 회원들이 피드·조행기 게시글에 <b className="text-navy-600">상품 태그</b>를 달 수 있습니다.<br />
            OFF: 상품 태그 기능이 비활성화됩니다. (쇼핑 메뉴와는 별개로 동작합니다)
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={on}
          aria-label="쇼핑 태그"
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
          <><Loader2 size={16} className="animate-spin text-orange-500" /> 저장 중...</>
        ) : on ? (
          <><Tag size={16} className="text-orange-500" /> 상품 태그 <span className="text-orange-500">활성화</span></>
        ) : (
          <><XCircle size={16} className="text-navy-400" /> 상품 태그 <span className="text-navy-400">비활성화</span></>
        )}
      </div>
    </div>
  );
}
