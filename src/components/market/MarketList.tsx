"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpDown, Check, ChevronDown, MapPin, Heart, SlidersHorizontal, MessageCircle } from "lucide-react";
import { won, timeAgo, cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui";
import { ViewToggle, useViewMode } from "@/components/FeedList";
import { TextSearchInput, normalizeTextQuery } from "@/components/FeedSearch";
import {
  MARKET_CATEGORIES, MARKET_REGIONS, MARKET_SORTS,
  marketCategoryLabel, marketStatusLabel,
} from "@/lib/taxonomy";
import { NO_IMAGE_SRC } from "@/lib/noImage";

export type MarketItem = {
  id: string;
  title: string;
  category: string;
  condition: string;
  price: number;
  region: string | null;
  status: string;
  /** 목록 검색(본문 매칭)용 — 없으면 제목으로만 검색한다 */
  description?: string | null;
  createdAt: string;
  thumbnail: string | null;
  favoriteCount: number;
  chatCount: number;
};

export function MarketList({ items }: { items: MarketItem[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [category, setCategory] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [hideSold, setHideSold] = useState(false);
  const [viewMode, setViewMode] = useViewMode("ipnak_view_market");
  // 목록 내 검색 — 상품명/본문 기준 클라이언트 필터
  const [keyword, setKeyword] = useState("");

  const visible = useMemo(() => {
    const key = normalizeTextQuery(keyword);
    let list = items.filter((it) =>
      (category === "ALL" || it.category === category) &&
      (region === "ALL" || it.region === region) &&
      (!hideSold || it.status !== "SOLD") &&
      (q.trim() === "" || it.title.toLowerCase().includes(q.trim().toLowerCase())) &&
      (key === "" ||
        it.title.toLowerCase().includes(key) ||
        (it.description ?? "").toLowerCase().includes(key))
    );
    list = [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return list;
  }, [items, q, keyword, category, region, sort, hideSold]);

  return (
    <div>
      {/* 카테고리 칩 */}
      <div className="flex gap-2 overflow-x-auto px-3 pb-2 no-scrollbar">
        <Chip active={category === "ALL"} onClick={() => setCategory("ALL")}>전체</Chip>
        {MARKET_CATEGORIES.map((c) => (
          <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</Chip>
        ))}
      </div>

      {/* 지역 / 정렬 / 판매완료 숨김 */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
        <MarketFilterDropdown
          value={region}
          onChange={setRegion}
          ariaLabel="거래 지역 선택"
          icon={<MapPin size={14} />}
          options={[
            { value: "ALL", label: "전체 지역" },
            ...MARKET_REGIONS.map((item) => ({ value: item, label: item })),
          ]}
        />
        <MarketFilterDropdown
          value={sort}
          onChange={setSort}
          ariaLabel="상품 정렬 선택"
          icon={<ArrowUpDown size={14} />}
          options={MARKET_SORTS.map((item) => ({
            value: item.key,
            label: item.label,
          }))}
        />
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

      {/* 목록 검색 + 보기 모드 토글 — 검색창이 왼쪽 끝부터 토글 앞까지 가로폭을 채운다 */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <TextSearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="상품명·내용 검색"
          label="상품 목록 검색"
          className="flex-1"
        />
        <div className="shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="조건에 맞는 상품이 없습니다" desc="검색어나 필터를 바꿔보세요" />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-3 gap-0.5 pb-10">
          {visible.map((it) => {
            const sold = it.status === "SOLD";
            return (
              <Link key={it.id} href={`/market/${it.id}`} className="relative aspect-square overflow-hidden bg-[#1a2a38]">
                {it.thumbnail ? (
                  <Image src={it.thumbnail} alt={it.title} fill sizes="33vw"
                    className={cn("h-full w-full object-cover", sold && "opacity-40 grayscale")}
                    onError={(e) => { e.currentTarget.src = NO_IMAGE_SRC; }} />
                ) : (
                  <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-full w-full object-cover" />
                )}
                {it.status !== "SELLING" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {marketStatusLabel(it.status)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-2">
                  <p className="line-clamp-1 text-[10px] font-semibold text-white">{it.title}</p>
                  <p className={cn("text-[11px] font-extrabold", sold ? "text-navy-300 line-through" : "text-white")}>
                    {won(it.price)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
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
                    <Image
                      src={it.thumbnail}
                      alt={it.title}
                      fill
                      sizes="110px"
                      className={cn("h-full w-full object-cover transition-transform duration-300 group-hover:scale-105", sold && "opacity-50 grayscale")}
                      onError={(e) => { e.currentTarget.src = NO_IMAGE_SRC; }}
                    />
                  ) : (
                    <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-full w-full object-cover" />
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

type DropdownOption = {
  value: string;
  label: string;
};

function MarketFilterDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold shadow-sm transition-all",
          open
            ? "border-orange-400/70 bg-orange-500/10 text-orange-400 ring-2 ring-orange-400/10"
            : "border-white/10 bg-[#122030] text-navy-500 hover:border-white/20 hover:text-navy-800"
        )}
      >
        <span className={open ? "text-orange-400" : "text-aqua-400"}>{icon}</span>
        <span>{selected.label}</span>
        <ChevronDown
          size={14}
          className={cn("ml-0.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-11 z-50 max-h-64 min-w-[180px] overflow-y-auto rounded-2xl border border-white/10 bg-[#142438] p-1.5 shadow-2xl shadow-black/50"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold tracking-[0.08em] text-white/35">
            {ariaLabel}
          </div>
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors",
                  active
                    ? "bg-orange-500 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <span>{option.label}</span>
                {active && <Check size={15} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
