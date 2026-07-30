"use client";

import Link from "next/link";
import { Tag, ChevronRight } from "lucide-react";
import { useState } from "react";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { NO_IMAGE_SRC } from "@/lib/noImage";

type ProductCard = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  price: number;
  imageUrl: string | null;
};

type SectionData = {
  key: string;
  label: string;
  color: string;
  products: ProductCard[];
};

export function ShopSectionPicker({ sections }: { sections: SectionData[] }) {
  const available = sections.filter((s) => s.products.length > 0);
  const [activeKey, setActiveKey] = useState<string>(available[0]?.key ?? "");

  if (available.length === 0) return null;

  const activeSection = available.find((s) => s.key === activeKey) ?? available[0];

  const accentColors: Record<string, { tab: string; tabActive: string; dot: string }> = {
    orange: {
      tab: "border-orange-500/20 text-orange-400/60",
      tabActive: "border-orange-500 bg-orange-500/10 text-orange-400",
      dot: "bg-orange-500",
    },
    aqua: {
      tab: "border-aqua-500/20 text-aqua-400/60",
      tabActive: "border-aqua-400 bg-aqua-500/10 text-aqua-400",
      dot: "bg-aqua-400",
    },
    amber: {
      tab: "border-amber-500/20 text-amber-400/60",
      tabActive: "border-amber-400 bg-amber-500/10 text-amber-400",
      dot: "bg-amber-400",
    },
    rose: {
      tab: "border-rose-500/20 text-rose-400/60",
      tabActive: "border-rose-500 bg-rose-500/10 text-rose-400",
      dot: "bg-rose-500",
    },
  };

  return (
    <div>
      {/* ── 섹션 탭 버튼 ── */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {available.map((s) => {
          const c = accentColors[s.color] ?? accentColors.orange;
          const isActive = s.key === activeKey;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveKey(s.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-all ${
                isActive ? c.tabActive : c.tab
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── 상품 카드 목록 ── */}
      <div className="space-y-3 px-4">
        {activeSection.products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-navy-100/30 bg-[#162538] shadow-card transition-all duration-150 hover:border-navy-100/60 hover:shadow-cardhover active:scale-[0.985]"
          >
            {/* 상품 이미지 */}
            <div className="h-[100px] w-[100px] shrink-0 overflow-hidden bg-[#0d1b2a]">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-full w-full object-cover" />
              )}
            </div>

            {/* 상품 정보 */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
              <span className="flex w-fit items-center gap-1 rounded-md bg-aqua-500/10 px-1.5 py-0.5 text-[10px] font-bold text-aqua-400">
                <Tag size={8} />
                {productCategoryLabel(product.category)}
              </span>
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-navy-800">
                {product.name}
              </p>
              {product.brand && (
                <p className="text-[11px] text-navy-400">{product.brand}</p>
              )}
              <p className="text-[15px] font-extrabold text-orange-400">
                {won(product.price)}
              </p>
            </div>

            <div className="flex items-center pr-3">
              <ChevronRight
                size={17}
                className="shrink-0 text-navy-400 transition-colors group-hover:text-navy-600"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
