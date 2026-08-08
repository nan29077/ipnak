"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ShoppingBag, X, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import { won } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Product = {
  id: string; name: string; brand: string | null; category: string; price: number; imageUrl: string | null;
};
type FeaturedItem = { id: string; section: string; order: number; product: Product };
type Section = { key: string; label: string; color: string };

const SECTIONS: Section[] = [
  { key: "TODAY",   label: "오늘의 상품",  color: "orange" },
  { key: "WEEKLY",  label: "이번 주 추천", color: "aqua"   },
  { key: "MONTHLY", label: "이번 달 추천", color: "amber"  },
  { key: "BEST",    label: "베스트 상품",  color: "rose"   },
];

export function FeaturedProductPanel({ products, featured: init }: { products: Product[]; featured: FeaturedItem[] }) {
  const [featured, setFeatured] = useState<FeaturedItem[]>(init);
  const [loading, setLoading] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null); // 열린 섹션 key
  const router = useRouter();
  const toast = useToast();

  const inSection = (key: string) => featured.filter((f) => f.section === key);

  async function add(productId: string, section: string) {
    const key = `add-${section}-${productId}`;
    setLoading(key);
    try {
      const res = await fetch("/api/admin/featured-products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, section }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("추가됐습니다", "success");
      setFeatured((prev) => [...prev, data.record]);
      router.refresh();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(null); }
  }

  async function remove(id: string) {
    setLoading(`del-${id}`);
    try {
      const res = await fetch("/api/admin/featured-products", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("제거됐습니다", "success");
      setFeatured((prev) => prev.filter((f) => f.id !== id));
      router.refresh();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(null); }
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-navy-400">각 섹션의 추천 상품 추가 버튼을 눌러 전체 상품 목록에서 선택하세요. 섹션당 최대 5개.</p>

      {SECTIONS.map((sec) => {
        const items = inSection(sec.key);
        const isFull = items.length >= 5;
        const inIds = new Set(items.map((f) => f.product.id));

        return (
          <div key={sec.key} className="rounded-2xl border border-navy-100/30 bg-[#162538] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full",
                sec.color === "orange" && "bg-orange-500",
                sec.color === "aqua"   && "bg-aqua-400",
                sec.color === "amber"  && "bg-amber-400",
                sec.color === "rose"   && "bg-rose-500",
              )} />
              <h3 className="text-[15px] font-bold text-navy-800">{sec.label}</h3>
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isFull ? "bg-red-500/15 text-red-400" : "bg-navy-100/30 text-navy-400"
              )}>{items.length}/5</span>
            </div>

            {/* 등록된 상품 목록 */}
            {items.length > 0 ? (
              <div className="mb-3 space-y-2">
                {items.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl bg-navy-900/30 p-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                      {f.product.imageUrl
                        ? <img src={f.product.imageUrl} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center"><ShoppingBag size={16} className="text-navy-300" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-navy-700">{f.product.name}</p>
                      <p className="text-[11px] text-navy-400">{f.product.brand && `${f.product.brand} · `}{won(f.product.price)}</p>
                    </div>
                    <button onClick={() => remove(f.id)} disabled={loading === `del-${f.id}`}
                      className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50">
                      {loading === `del-${f.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 rounded-xl bg-navy-900/20 py-3 text-center text-[12px] text-navy-400">등록된 상품이 없습니다</p>
            )}

            {/* 추가 버튼 */}
            {!isFull && (
              <button onClick={() => setPopup(sec.key)}
                className={cn("inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all active:scale-[0.97]",
                  sec.color === "orange" && "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25",
                  sec.color === "aqua"   && "bg-aqua-400/15 text-aqua-400 hover:bg-aqua-400/25",
                  sec.color === "amber"  && "bg-amber-400/15 text-amber-400 hover:bg-amber-400/25",
                  sec.color === "rose"   && "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25",
                )}>
                <Plus size={14} /> 추천 상품 추가
              </button>
            )}

            {/* 팝업 모달 */}
            {popup === sec.key && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPopup(null)}>
                <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-[#0d1b2a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-navy-100/20 p-4">
                    <h4 className="text-[15px] font-bold text-navy-800">{sec.label} 상품 선택</h4>
                    <button onClick={() => setPopup(null)} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-100/10"><X size={18} /></button>
                  </div>
                  <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 64px)" }}>
                    {products.length === 0 ? (
                      <p className="py-8 text-center text-[13px] text-navy-400">등록된 상품이 없습니다. 먼저 상품 목록 탭에서 상품을 등록하세요.</p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((p) => {
                          const isIn = inIds.has(p.id);
                          const isLoading = loading === `add-${sec.key}-${p.id}`;
                          return (
                            <button key={p.id} onClick={() => { if (!isIn) add(p.id, sec.key); }}
                              disabled={isIn || !!loading}
                              className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all",
                                isIn ? "bg-orange-500/10 opacity-70" : "bg-navy-900/30 hover:bg-navy-900/50 active:scale-[0.98]",
                              )}>
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                                {p.imageUrl
                                  ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                                  : <div className="flex h-full w-full items-center justify-center"><ShoppingBag size={18} className="text-navy-300" /></div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-navy-700">{p.name}</p>
                                <p className="text-[11px] text-navy-400">{p.brand && `${p.brand} · `}{won(p.price)}</p>
                              </div>
                              <div className="shrink-0">
                                {isLoading ? <Loader2 size={16} className="animate-spin text-orange-400" />
                                  : isIn ? <Check size={16} className="text-orange-400" />
                                  : <Plus size={16} className="text-navy-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
