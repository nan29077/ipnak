"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, BookOpen, Store, Users, FileText, Route } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/feed", label: "피싱 피드", icon: Newspaper, match: (p: string) => p === "/feed" || p.startsWith("/feed/") },
  { href: "/general", label: "일반 피드", icon: FileText, match: (p: string) => p.startsWith("/general") },
  { href: "/log", label: "조행기", icon: BookOpen, match: (p: string) => p.startsWith("/log") },
  { href: "/market", label: "중고피싱", icon: Store, match: (p: string) => p.startsWith("/market") },
  { href: "/walking", label: "워킹 피드", icon: Route, match: (p: string) => p.startsWith("/walking") },
  { href: "/groups", label: "낚시단", icon: Users, match: (p: string) => p.startsWith("/groups") },
];

// 커뮤니티 탭: 3열 2행 그리드 (모바일 최적화)
export function CommunityTabs() {
  const pathname = usePathname() || "/";
  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-2.5">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[12px] font-semibold transition-all active:scale-[0.96]",
              active
                ? "bg-orange-500 text-white shadow-soft"
                : "bg-navy-50 text-navy-500 hover:bg-navy-100"
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="leading-none">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
