"use client";
import { useState } from "react";
import { Tag, ExternalLink, TrendingUp } from "lucide-react";
import { useToast } from "@/components/Toast";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import type { FeedProductTag } from "@/lib/queries";

/**
 * 피싱태그(네이버 쇼핑 커넥트형 제휴) 상품 카드 목록.
 * - 카드 클릭 시 /api/referral/click 으로 클릭 추적 후 구매 링크로 이동.
 * - MOCK 모드에서는 일부 클릭이 전환(구매)으로 시뮬레이션되어 작성자에게 리퍼럴 수익이 적립된다.
 */
export function FishingTagCards({ postId, tags, compact = false }: { postId: string; tags: FeedProductTag[]; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!tags.length) return null;

  async function go(t: FeedProductTag) {
    setBusy(t.id);
    try {
      const res = await fetch("/api/referral/click", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, productId: t.product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.converted) {
        toast(`구매 전환! 작성자에게 ${won(data.reward || 0)} 적립`, "success");
      }
    } catch { /* 추적 실패해도 이동은 진행 */ }
    finally { setBusy(null); }
    const url = t.product.buyUrl && t.product.buyUrl !== "#" ? t.product.buyUrl : `/shop/${t.product.id}`;
    if (/^https?:\/\//.test(url)) window.open(url, "_blank", "noopener");
    else window.location.href = url;
  }

  return (
    <div className={compact ? "" : "mt-1"}>
      {!compact && (
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-navy-500">
          <Tag size={13} className="text-orange-400" /> 피싱태그 · 이 글에 쓰인 장비
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tags.map((t) => (
          <button key={t.id} type="button" onClick={() => go(t)} disabled={busy === t.id}
            className="flex w-[210px] shrink-0 items-center gap-2.5 rounded-xl border border-navy-100 bg-[#242424] p-2 pr-3 text-left transition-colors hover:border-orange-500/50 active:scale-[0.99] disabled:opacity-60">
            <img src={t.product.imageUrl || ""} alt={t.product.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-navy-900">{t.product.name}</span>
              <span className="block truncate text-[11px] text-navy-400">{productCategoryLabel(t.product.category)} · {won(t.product.price)}</span>
              <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1 py-px text-[10px] font-bold text-orange-400">
                <TrendingUp size={9} /> 구매 시 작성자 적립
              </span>
            </span>
            <ExternalLink size={14} className="shrink-0 text-navy-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
