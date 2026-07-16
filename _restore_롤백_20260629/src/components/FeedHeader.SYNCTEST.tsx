"use client";
import { useState } from "react";
import { Chip } from "@/components/ui";

const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "FISHING_POINT", label: "피싱 포인트" },
  { key: "GENERAL", label: "일반" },
];

export function FeedHeader({ onFilter }: { onFilter?: (k: string) => void }) {
  const [active, setActive] = useState("ALL");
  return (
    <header className="sticky top-12 z-30 border-b border-navy-100 bg-[#161616]/85 backdrop-blur-md">
      <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-2.5 no-scrollbar">
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
