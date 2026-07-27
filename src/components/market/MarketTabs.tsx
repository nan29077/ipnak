"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/appSettingsContext";

const TABS = [
  {
    href: "/shop",
    label: "쇼핑",
    icon: ShoppingBag,
    match: (pathname: string) => pathname.startsWith("/shop"),
  },
  {
    href: "/market",
    label: "중고마켓",
    icon: Store,
    match: (pathname: string) => pathname.startsWith("/market"),
  },
];

export function MarketTabs() {
  const pathname = usePathname() || "/";
  const { shopMenuEnabled } = useAppSettings();

  // 쇼핑 메뉴 노출 OFF: 쇼핑 탭을 숨기고 중고마켓만 노출 → 탭 자체를 표시하지 않는다
  if (!shopMenuEnabled) return null;

  return (
    <nav className="px-4 pb-3" aria-label="마켓 메뉴">
      <div className="grid grid-cols-2 rounded-2xl bg-navy-50 p-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-bold transition-all active:scale-[0.98]",
                active
                  ? "bg-orange-500 text-white shadow-soft"
                  : "text-navy-400 hover:bg-white/5 hover:text-navy-700"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
