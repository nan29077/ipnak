"use client";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = { id: string; name: string; brand: string | null; category: string; price: number; imageUrl: string | null };
export type TagPosition = { posX: number; posY: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function ProductTagPlacer({
  photoUrl,
  selected,
  positions,
  onChange,
}: {
  photoUrl: string;
  selected: string[];
  positions: Record<string, TagPosition>;
  onChange: (positions: Record<string, TagPosition>) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeId, setActiveId] = useState<string | null>(selected[0] ?? null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (products.length === 0) {
      fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products || []));
    }
  }, [products.length]);

  // keep an active product that is actually selected
  useEffect(() => {
    if (!activeId || !selected.includes(activeId)) setActiveId(selected[0] ?? null);
  }, [selected, activeId]);

  const chosen = products.filter((p) => selected.includes(p.id));
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "상품";

  const place = (e: React.MouseEvent<HTMLImageElement> | React.TouchEvent<HTMLImageElement>) => {
    if (!activeId || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const pt = "touches" in e ? e.changedTouches[0] : e;
    const posX = clamp01((pt.clientX - rect.left) / rect.width);
    const posY = clamp01((pt.clientY - rect.top) / rect.height);
    onChange({ ...positions, [activeId]: { posX, posY } });
  };

  if (selected.length === 0 || !photoUrl) return null;

  return (
    <section>
      <label className="mb-2 block text-sm font-semibold text-navy-700">
        <MapPin size={15} className="mr-1 inline text-aqua-500" /> 사진에 태그 위치 지정
        <span className="ml-2 text-xs font-normal text-navy-300">상품을 고른 뒤 사진을 탭하세요</span>
      </label>

      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition btn-press",
                activeId === p.id ? "bg-navy-700 text-white shadow-soft" : "bg-aqua-50 text-aqua-700 hover:bg-aqua-100",
              )}
            >
              <ShoppingBag size={12} />
              {p.name}
              {positions[p.id] && <span className={cn("ml-0.5", activeId === p.id ? "text-aqua-200" : "text-aqua-500")}>· 지정됨</span>}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-navy-100 bg-navy-50 shadow-card">
        <img
          ref={imgRef}
          src={photoUrl}
          alt="태그 위치 지정"
          onClick={place}
          onTouchEnd={place}
          className="block w-full cursor-crosshair select-none touch-none object-contain"
          draggable={false}
        />
        {chosen.map((p) => {
          const pos = positions[p.id];
          if (!pos) return null;
          return (
            <span
              key={p.id}
              style={{ left: `${pos.posX * 100}%`, top: `${pos.posY * 100}%` }}
              className={cn(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 inline-flex max-w-[60%] items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-md ring-2 ring-white/70",
                activeId === p.id ? "bg-navy-700" : "bg-navy-700/80",
              )}
            >
              <ShoppingBag size={12} className="shrink-0" />
              <span className="truncate">{nameOf(p.id)}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
