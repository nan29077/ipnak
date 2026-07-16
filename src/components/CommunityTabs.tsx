"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, BookOpen, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/feed", label: "피싱 피드", icon: Newspaper, match: (p: string) => p.startsWith("/feed") },
  { href: "/log", label: "조행기", icon: BookOpen, match: (p: string) => p.startsWith("/log") },
  { href: "/market", label: "중고피싱", icon: Store, match: (p: string) => p.startsWith("/market") },
];

// 커뮤니티 상단 세그먼트 탭: 피싱 피드 ↔ 조행기 ↔ 중고피싱
export function CommunityTabs() {
  const pathname = usePathname() || "/";
  return (
    <div className="flex gap-1.5 px-3 pb-2 pt-1">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-[0.97]",
              active ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100"
            )}
          >
            <Icon size={15} strokeWidth={active ? 2.4 : 2} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
