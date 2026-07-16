"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Heart, SlidersHorizontal } from "lucide-react";
import { won, timeAgo, cn } from "@/lib/utils";
import { Badge, EmptyState, Select } from "@/components/ui";
import {
  MARKET_CATEGORIES, MARKET_REGIONS, MARKET_SORTS,
  marketCategoryLabel, marketStatusLabel, marketConditionLabel,
} from "@/lib/taxonomy";

export type MarketItem = {
  id: string;
  title: string;
  category: string;
  condition: string;
  price: number;
  region: string | null;
  status: string;
  createdAt: string;
  thumbnail: string | null;
  favoriteCount: number;
  chatCount: number;
};

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

export function MarketList({ items }: { items: MarketItem[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [hideSold, setHideSold] = useState(false);

  const visible = useMemo(() => {
    let list = items.filter((it) =>
      (category === "ALL" || it.category === category) &&
      (region === "ALL" || it.region === region) &&
      (!hideSold || it.status !== "SOLD") &&
      (q.trim() === "" || it.title.toLowerCase().includes(q.trim().toLowerCase()))
    );
    list = [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return list;
  }, [items, q, category, region, sort, hideSold]);

  return (
    <div>
      {/* 검색 */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-2xl border border-navy-100 bg-[#1e1e1e] px-3 py-2.5 shadow-soft focus-within:border-aqua-400 focus-within:ring-2 focus-within:ring-aqua-100">
          <Search size={18} className="shrink-0 text-navy-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="찾는 낚시 용품을 검색하세요"
            className="w-full bg-transparent text-[14px] text-navy-800 placeholder-navy-300 outline-none"
          />
        </div>
      </div>

      {/* 카테고리 칩 */}
      <div className="flex gap-2 overflow-x-auto px-3 pb-2 no-scrollbar">
        <Chip active={category === "ALL"} onClick={() => setCategory("ALL")}>전체</Chip>
        {MARKET_CATEGORIES.map((c) => (
          <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</Chip>
        ))}
      </div>

      {/* 지역 / 정렬 / 판매완료 숨김 */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-auto rounded-full py-2 text-[13px]">
          <option value="ALL">전체 지역</option>
          {MARKET_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto rounded-full py-2 text-[13px]">
          {MARKET_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <button
          onClick={() => setHideSold((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            hideSold ? "bg-orange-500 text-white" : "bg-navy-50 text-navy-500 hover:bg-navy-100"
          )}
        >
          <SlidersHorizontal size={13} /> 판매중만
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="조건에 맞는 상품이 없습니다" desc="검색어나 필터를 바꿔보세요" />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3 pb-10 md:grid-cols-3">
          {visible.map((it) => {
            const sold = it.status === "SOLD";
            return (
              <Link
                key={it.id}
                href={`/market/${it.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardhover"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-navy-50">
                  {it.thumbnail && (
                    <img
                      src={it.thumbnail}
                      alt={it.title}
                      loading="lazy"
                      decoding="async"
                      className={cn("h-full w-full object-cover transition-transform duration-300 group-hover:scale-105", sold && "opacity-60")}
                    />
                  )}
                  {it.status !== "SELLING" && (
                    <span className="absolute left-2 top-2">
                      <Badge tone={STATUS_TONE[it.status]} className="bg-black/80 text-white">{marketStatusLabel(it.status)}</Badge>
                    </span>
                  )}
                  {it.favoriteCount > 0 && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                      <Heart size={11} className="fill-white" /> {it.favoriteCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                  <div className="flex items-center gap-1">
                    <Badge tone="navy" className="px-1.5 py-0.5 text-[10px]">{marketCategoryLabel(it.category)}</Badge>
                    {it.condition === "NEW" && <Badge tone="aqua" className="px-1.5 py-0.5 text-[10px]">{marketConditionLabel("NEW")}</Badge>}
                  </div>
                  <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-navy-800">{it.title}</h3>
                  <p className="mt-auto pt-1 text-[15px] font-extrabold text-navy-900">{won(it.price)}</p>
                  <p className="flex items-center gap-1 text-[11px] text-navy-300">
                    {it.region && <span className="inline-flex items-center gap-0.5"><MapPin size={10} />{it.region}</span>}
                    <span>· {timeAgo(it.createdAt)}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-all active:scale-[0.97]",
        active ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100"
      )}
    >
      {children}
    </button>
  );
}
