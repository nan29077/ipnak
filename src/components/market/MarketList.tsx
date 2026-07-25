"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Heart, SlidersHorizontal, MessageCircle } from "lucide-react";
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
        <div className="flex items-center gap-2 rounded-2xl border border-[#2a2a2a] bg-[#122030] px-3 py-2.5 shadow-soft focus-within:border-aqua-400 focus-within:ring-2 focus-within:ring-aqua-100">
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
        <div className="divide-y divide-navy-100/20 pb-10">
          {visible.map((it) => {
            const sold = it.status === "SOLD";
            return (
              <Link
                key={it.id}
                href={`/market/${it.id}`}
                className="group flex items-start gap-3.5 px-3.5 py-4 transition-colors active:bg-navy-50/10"
              >
                {/* 썸네일 */}
                <div className="relative h-[110px] w-[110px] shrink-0 overflow-hidden rounded-2xl bg-navy-100/20">
                  {it.thumbnail ? (
                    <img
                      src={it.thumbnail}
                      alt={it.title}
                      loading="lazy"
                      decoding="async"
                      className={cn("h-full w-full object-cover transition-transform duration-300 group-hover:scale-105", sold && "opacity-50 grayscale")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-navy-300">
                      <SlidersHorizontal size={28} />
                    </div>
                  )}
                  {it.status !== "SELLING" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                      <span className="rounded-lg bg-black/70 px-2 py-1 text-[12px] font-bold text-white">
                        {marketStatusLabel(it.status)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {it.condition === "NEW" && (
                      <span className="rounded-md bg-aqua-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-aqua-400">새상품</span>
                    )}
                    <span className="rounded-md bg-navy-50/20 px-1.5 py-0.5 text-[10px] font-medium text-navy-400">{marketCategoryLabel(it.category)}</span>
                  </div>
                  <h3 className={cn("line-clamp-2 text-[15px] font-medium leading-snug text-navy-800", sold && "text-navy-400")}>{it.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-navy-400">
                    {it.region && <><span>{it.region}</span><span>·</span></>}
                    <span>{timeAgo(it.createdAt)}</span>
                  </p>
                  <p className={cn("mt-1.5 text-[17px] font-extrabold", sold ? "text-navy-300 line-through" : "text-navy-900")}>{won(it.price)}</p>

                  {/* 하단 정보 */}
                  {(it.favoriteCount > 0 || it.chatCount > 0) && (
                    <div className="mt-1.5 flex items-center gap-3 text-[12px] text-navy-400">
                      {it.chatCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={12} /> 채팅 {it.chatCount}
                        </span>
                      )}
                      {it.favoriteCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Heart size={12} /> 관심 {it.favoriteCount}
                        </span>
                      )}
                    </div>
                  )}
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
