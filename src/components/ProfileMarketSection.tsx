"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Search, X, Heart, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn, won } from "@/lib/utils";
import { marketCategoryLabel, marketStatusLabel, MARKET_CATEGORIES } from "@/lib/taxonomy";

type MarketListing = {
  id: string;
  title: string;
  category: string;
  condition: string;
  price: number;
  status: string;
  createdAt: string;
  thumbnail: string | null;
  favoriteCount: number;
  chatCount: number;
};

export function ProfileMarketSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");

  useEffect(() => {
    if (!open || fetched) return;
    setLoading(true);
    fetch(`/api/market?sellerId=${userId}&sort=recent`)
      .then((r) => r.json())
      .then((d) => { setListings(d.listings || []); setFetched(true); })
      .catch(() => { setListings([]); setFetched(true); })
      .finally(() => setLoading(false));
  }, [open, userId, fetched]);

  const visible = listings.filter((it) => {
    if (category !== "ALL" && it.category !== category) return false;
    if (q.trim() && !it.title.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  const sellingCount = listings.filter((l) => l.status === "SELLING").length;

  return (
    <div className="mt-3">
      {/* 토글 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.98]",
          open
            ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
            : "border-navy-100/30 bg-[#162538] text-navy-600 hover:border-orange-500/30 hover:text-orange-400"
        )}
      >
        <ShoppingBag size={16} strokeWidth={1.7} />
        <span>중고피싱</span>
        {fetched && sellingCount > 0 && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {sellingCount}
          </span>
        )}
        <span className="absolute right-4">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* 펼쳐지는 섹션 */}
      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-navy-100/20 bg-[#0f1e2d]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* 검색 */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 rounded-xl border border-navy-100/15 bg-[#162538] px-3 py-2 focus-within:border-orange-400/40">
                  <Search size={14} className="shrink-0 text-navy-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="상품명 검색"
                    className="w-full bg-transparent text-[13px] text-navy-800 placeholder-navy-300 outline-none"
                  />
                  {q && (
                    <button type="button" onClick={() => setQ("")}>
                      <X size={13} className="text-navy-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* 카테고리 칩 */}
              <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
                {[{ key: "ALL", label: "전체" }, ...MARKET_CATEGORIES].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      "inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
                      category === c.key
                        ? "bg-orange-500 text-white"
                        : "bg-[#1c2c3e] text-navy-400"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* 목록 */}
              {visible.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <ShoppingBag size={22} className="text-navy-400" strokeWidth={1.3} />
                  <p className="text-[13px] text-navy-500">
                    {listings.length === 0 ? "판매 중인 상품이 없습니다" : "조건에 맞는 상품이 없습니다"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-navy-100/10">
                  {visible.map((it) => {
                    const sold = it.status === "SOLD";
                    return (
                      <Link
                        key={it.id}
                        href={`/market/${it.id}`}
                        className="flex items-start gap-3 px-3 py-3 transition-colors active:bg-navy-50/10"
                      >
                        {/* 썸네일 */}
                        <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-navy-100/20">
                          {it.thumbnail ? (
                            <img
                              src={it.thumbnail}
                              alt={it.title}
                              loading="lazy"
                              className={cn("h-full w-full object-cover", sold && "opacity-50 grayscale")}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ShoppingBag size={20} className="text-navy-300" strokeWidth={1.3} />
                            </div>
                          )}
                          {it.status !== "SELLING" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                {marketStatusLabel(it.status)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 내용 */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-1">
                            {it.condition === "NEW" && (
                              <span className="rounded bg-aqua-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-aqua-400">새상품</span>
                            )}
                            <span className="rounded bg-navy-50/20 px-1.5 py-0.5 text-[10px] font-medium text-navy-400">
                              {marketCategoryLabel(it.category)}
                            </span>
                            {it.status === "RESERVED" && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">예약중</span>
                            )}
                          </div>
                          <h3 className={cn(
                            "line-clamp-2 text-[13px] font-semibold leading-snug",
                            sold ? "text-navy-400" : "text-navy-800"
                          )}>
                            {it.title}
                          </h3>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className={cn(
                              "text-[15px] font-extrabold",
                              sold ? "text-navy-300 line-through" : "text-navy-900"
                            )}>
                              {won(it.price)}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-navy-400">
                              {it.chatCount > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MessageCircle size={11} /> {it.chatCount}
                                </span>
                              )}
                              {it.favoriteCount > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Heart size={11} /> {it.favoriteCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
