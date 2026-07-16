"use client";
import Link from "next/link";
import { useState } from "react";
import { Anchor, Bell, Search } from "lucide-react";
import { Chip } from "@/components/ui";

const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "FISHING_POINT", label: "피싱 포인트" },
  { key: "GENERAL", label: "일반" },
];

export function FeedHeader({ onFilter }: { onFilter?: (k: string) => void }) {
  const [active, setActive] = useState("ALL");
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-navy-100 bg-white/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 md:hidden">
        <Anchor className="text-aqua-500" size={22} />
        <span className="mr-auto text-xl font-extrabold tracking-tight text-navy-900">입낚</span>
        <Link href="/map" aria-label="검색" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"><Search size={21} /></Link>
        <Link href="/me" aria-label="알림" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"><Bell size={21} /></Link>
      </div>
      <div className="hidden h-14 items-center px-4 md:flex">
        <h1 className="text-lg font-bold text-navy-900">피드</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 no-scrollbar">
        {FILTERS.map((f) => (
          <Chip key={f.key} size="sm" active={active === f.key}
            onClick={() => { setActive(f.key); onFilter?.(f.key); }}>
            {f.label}
          </Chip>
        ))}
      </div>
    </header>
  );
}
