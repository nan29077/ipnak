"use client";
import { useEffect, useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { Sheet, Badge, Button } from "@/components/ui";
import { won, cn } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";

type Product = { id: string; name: string; brand: string | null; category: string; price: number; imageUrl: string | null };

export function ProductTagPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (open && products.length === 0) {
      fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products || []));
    }
  }, [open, products.length]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const chosen = products.filter((p) => selected.includes(p.id));

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-navy-100 bg-[#1e1e1e] px-3.5 py-3 text-sm text-navy-700 shadow-card transition-colors hover:bg-navy-50/40 btn-press">
        <span className="flex items-center gap-2 font-semibold"><ShoppingBag size={18} className="text-aqua-500" /> 피싱태그 추가</span>
        {selected.length > 0 ? <Badge tone="navy">{selected.length}개 선택</Badge> : <span className="text-navy-300">선택</span>}
      </button>

      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <Badge key={p.id} tone="aqua">{p.name}</Badge>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="피싱태그 선택">
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {products.length === 0 && <p className="py-6 text-center text-sm text-navy-300">상품을 불러오는 중...</p>}
          {products.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)}
                className={cn("flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors", on ? "border-navy-700 bg-navy-50" : "border-navy-100 hover:bg-navy-50/40")}>
                <img src={p.imageUrl || ""} alt={p.name} className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-800">{p.name}</p>
                  <p className="truncate text-xs text-navy-400">{p.brand} · {productCategoryLabel(p.category)} · {won(p.price)}</p>
                </div>
                {on && <Check size={18} className="shrink-0 text-navy-700" />}
              </button>
            );
          })}
        </div>
        <Button onClick={() => setOpen(false)} full size="lg" className="mt-3">완료{selected.length > 0 ? ` (${selected.length})` : ""}</Button>
      </Sheet>
    </div>
  );
}
