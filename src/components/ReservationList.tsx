"use client";
import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { Star, MapPin, Users } from "lucide-react";
import { won } from "@/lib/utils";
import { Card, Badge, Chip, Select, EmptyState } from "@/components/ui";
import { RESERVATION_CATEGORIES } from "@/lib/taxonomy";

type L = {
  id: string; name: string; category: string; region: string; imageUrl: string | null;
  price: number; maxPeople: number; rating: number; reviewCount: number; targetSpecies: string[];
};

const ReservationCard = memo(function ReservationCard({ l }: { l: L }) {
  return (
    <Card key={l.id} as="article" className="overflow-hidden p-0 transition-shadow hover:shadow-cardhover">
      <Link href={`/reservations/${l.id}`} className="block">
        <div className="relative h-36 bg-navy-50">
          {l.imageUrl && <img src={l.imageUrl} alt={l.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
          <span className="absolute left-2 top-2">
            <Badge tone="navy" className="bg-black/75 text-white">
              {RESERVATION_CATEGORIES.find((c) => c.key === l.category)?.label}
            </Badge>
          </span>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-bold text-navy-800">{l.name}</p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-navy-400">
            <span className="inline-flex items-center gap-0.5"><MapPin size={12} />{l.region}</span>
            <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" />{l.rating} ({l.reviewCount})</span>
            <span className="inline-flex items-center gap-0.5"><Users size={12} />~{l.maxPeople}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {l.targetSpecies.slice(0, 3).map((s) => <Badge key={s} tone="aqua" className="px-2 py-0.5 text-[10px]">{s}</Badge>)}
          </div>
          <p className="mt-2 text-base font-extrabold text-navy-800">{won(l.price)}<span className="text-xs font-normal text-navy-300"> / 1인</span></p>
        </div>
      </Link>
    </Card>
  );
});

export function ReservationList({ listings, regions }: { listings: L[]; regions: string[] }) {
  const [cat, setCat] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState(0);

  const visible = useMemo(
    () =>
      listings.filter((l) =>
        (cat === "ALL" || l.category === cat) &&
        (region === "ALL" || l.region === region) &&
        (maxPrice === 0 || l.price <= maxPrice)
      ),
    [listings, cat, region, maxPrice]
  );

  return (
    <div>
      {/* 카테고리 필터 */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar">
        <Chip active={cat === "ALL"} onClick={() => setCat("ALL")}>전체</Chip>
        {RESERVATION_CATEGORIES.map((c) => <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>)}
      </div>
      {/* 지역 + 가격 필터 */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-auto rounded-full py-2 text-[13px]">
          <option value="ALL">전체 지역</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-auto rounded-full py-2 text-[13px]">
          <option value={0}>전체 가격</option>
          <option value={50000}>5만원 이하</option>
          <option value={100000}>10만원 이하</option>
          <option value={150000}>15만원 이하</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="조건에 맞는 상품이 없습니다" desc="필터를 변경해 다시 검색해 보세요" />
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 pb-10 sm:grid-cols-2">
          {visible.map((l) => (
            <ReservationCard key={l.id} l={l} />
          ))}
        </div>
      )}
    </div>
  );
}