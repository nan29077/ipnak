"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, BookOpen, Users, FileText, Route } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/feed",
    label: "피싱 피드",
    icon: Newspaper,
    match: (pathname: string) =>
      pathname === "/feed" || pathname.startsWith("/feed/"),
  },
  {
    href: "/general",
    label: "일상 피드",
    icon: FileText,
    match: (pathname: string) => pathname.startsWith("/general"),
  },
  {
    href: "/log",
    label: "조행기",
    icon: BookOpen,
    match: (pathname: string) => pathname.startsWith("/log"),
  },
  {
    href: "/walking",
    label: "워킹 피드",
    icon: Route,
    match: (pathname: string) => pathname.startsWith("/walking"),
  },
  {
    href: "/groups",
    label: "낚시단",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/groups"),
  },
];

export function CommunityTabs() {
  const pathname = usePathname() || "/";

  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-2.5">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[12px] font-semibold transition-all active:scale-[0.96]",
              active
                ? "bg-orange-500 text-white shadow-soft"
                : "bg-navy-50 text-navy-500 hover:bg-navy-100"
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
