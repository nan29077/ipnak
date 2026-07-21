"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileImage, MessageCircle, Flag, Trophy, ClipboardCheck,
  Anchor, CalendarDays, ShoppingBag, Fish, SlidersHorizontal, Settings, Shield, LogOut, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = { href: string; label: string; icon: any; exact?: boolean };
type MenuGroup = { title: string; items: MenuItem[] };

const GROUPS: MenuGroup[] = [
  {
    title: "현황",
    items: [{ href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "회원·활동",
    items: [
      { href: "/admin/members", label: "회원 관리", icon: Users },
      { href: "/admin/posts", label: "게시글/피싱포인트", icon: FileImage },
      { href: "/admin/comments", label: "댓글 관리", icon: MessageCircle },
      { href: "/admin/reports", label: "신고 관리", icon: Flag },
    ],
  },
  {
    title: "커머스",
    items: [
      { href: "/admin/listings", label: "예약 상품 관리", icon: Anchor },
      { href: "/admin/bookings", label: "예약 내역 관리", icon: CalendarDays },
      { href: "/admin/products", label: "쇼핑 태그/상품", icon: ShoppingBag },
    ],
  },
  {
    title: "대회",
    items: [
      { href: "/admin/tournaments", label: "대회 관리", icon: Trophy },
      { href: "/admin/reviews", label: "대회 제출 심사", icon: ClipboardCheck },
    ],
  },
  {
    title: "콘텐츠",
    items: [{ href: "/admin/taxonomy", label: "낚시 분류/어종", icon: Fish }],
  },
  {
    title: "사이트 관리",
    items: [
      { href: "/admin/site", label: "사이트 관리", icon: SlidersHorizontal },
      { href: "/admin/settings", label: "환경설정·로그", icon: Settings },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export function AdminShell({ nickname, avatarUrl, children }: { nickname: string; avatarUrl: string | null; children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const isActive = (m: MenuItem) => (m.exact ? pathname === m.href : pathname.startsWith(m.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-row bg-navy-50/40">
      {/* 좌측 세로 네비게이션 */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-navy-100 bg-[#1e1e1e] md:flex">
        <div className="flex items-center gap-2 px-5 pt-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Shield size={18} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-navy-800">입낚 관리자</span>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-1">
              <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-navy-300">{g.title}</p>
              {g.items.map((m) => {
                const Icon = m.icon;
                const on = isActive(m);
                return (
                  <Link key={m.href} href={m.href}
                    aria-current={on ? "page" : undefined}
                    className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors btn-press",
                      on ? "bg-orange-500 text-white shadow-soft" : "text-navy-500 hover:bg-navy-50 hover:text-navy-800")}>
                    <Icon size={18} className={cn(!on && "text-navy-400")} /> {m.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-navy-100 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-navy-50/60 p-2">
            <img src={avatarUrl || ""} alt="" className="h-9 w-9 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-800">{nickname}</p>
              <p className="text-[11px] text-navy-400">최고관리자</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"><ExternalLink size={14} /> 앱으로 이동</Link>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"><LogOut size={14} /> 로그아웃</button>
        </div>
      </aside>

      {/* 모바일 상단 네비 (가로 스크롤) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-30 border-b border-navy-100 bg-[#161616]/90 backdrop-blur-md md:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white">
              <Shield size={16} />
            </span>
            <span className="font-extrabold tracking-tight text-navy-800">입낚 관리자</span>
            <button onClick={logout} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 btn-press"><LogOut size={13} /> 로그아웃</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
            {ALL_ITEMS.map((m) => {
              const on = isActive(m);
              return (
                <Link key={m.href} href={m.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors btn-press", on ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
                  {m.label}
                </Link>
              );
            })}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
