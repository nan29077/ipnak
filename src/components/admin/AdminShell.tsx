"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileImage, MessageCircle, Flag, Trophy, ClipboardCheck,
  Anchor, CalendarDays, ShoppingBag, Fish, SlidersHorizontal, Settings, Shield,
  LogOut, ExternalLink, Star, LayoutList, BadgeCheck, UsersRound, Menu, X, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";

type MenuItem = { href: string; label: string; icon: any; exact?: boolean };
type MenuGroup = { title: string; items: MenuItem[] };

const GROUPS: MenuGroup[] = [
  {
    title: "대시보드",
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "커뮤니티",
    items: [
      { href: "/admin/posts", label: "게시글 · 피싱포인트", icon: FileImage },
      { href: "/admin/comments", label: "댓글 관리", icon: MessageCircle },
      { href: "/admin/reports", label: "신고 · 제재", icon: Flag },
    ],
  },
  {
    title: "회원",
    items: [
      { href: "/admin/members", label: "회원 목록", icon: Users },
      { href: "/admin/points", label: "포인트 관리", icon: Coins },
      { href: "/admin/groups", label: "낚시단 관리", icon: UsersRound },
      { href: "/admin/pros", label: "프로 · 유튜버", icon: BadgeCheck },
    ],
  },
  {
    title: "기획 · 콘텐츠",
    items: [
      { href: "/admin/curation", label: "메인 큐레이션", icon: Star },
      { href: "/admin/sections", label: "홈 섹션 관리", icon: LayoutList },
      { href: "/admin/taxonomy", label: "낚시 분류 · 어종", icon: Fish },
    ],
  },
  {
    title: "마켓 · 예약",
    items: [
      { href: "/admin/listings", label: "예약 상품 관리", icon: Anchor },
      { href: "/admin/bookings", label: "예약 내역", icon: CalendarDays },
      { href: "/admin/products", label: "상품 태그", icon: ShoppingBag },
    ],
  },
  {
    title: "이벤트 · 대회",
    items: [
      { href: "/admin/tournaments", label: "낚시 대회", icon: Trophy },
      { href: "/admin/reviews", label: "대회 제출 심사", icon: ClipboardCheck },
    ],
  },
  {
    title: "사이트 설정",
    items: [
      { href: "/admin/site", label: "사이트 관리", icon: SlidersHorizontal },
      { href: "/admin/settings", label: "환경설정 · 로그", icon: Settings },
    ],
  },
];

export function AdminShell({ userId, nickname, avatarUrl, children }: { userId?: string; nickname: string; avatarUrl: string | null; children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isActive = (m: MenuItem) => (m.exact ? pathname === m.href : pathname.startsWith(m.href));

  // 경로 변경 시 모바일 드로어 자동 닫기
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  /* 사이드바 내용 (데스크톱 고정 사이드바 + 모바일 드로어 공용) */
  const sidebarContent = (
    <>
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-1">
            <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">{g.title}</p>
            {g.items.map((m) => {
              const Icon = m.icon;
              const on = isActive(m);
              return (
                <Link key={m.href} href={m.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors btn-press",
                    on ? "bg-orange-500 text-white shadow-soft" : "text-gray-400 hover:bg-white/[0.06] hover:text-white")}>
                  <Icon size={18} className={cn(!on && "text-gray-500")} /> {m.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/[0.05] p-2">
          <img src={userId ? getAvatarUrl(userId, avatarUrl) : (avatarUrl || "")} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{nickname}</p>
            <p className="text-[11px] text-gray-500">최고관리자</p>
          </div>
        </div>
        <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"><ExternalLink size={14} /> 앱으로 이동</Link>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"><LogOut size={14} /> 로그아웃</button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-row bg-navy-50/40">
      {/* 데스크톱: 좌측 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-white/10 bg-gray-900 md:flex">
        <div className="flex items-center gap-2 px-5 pt-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Shield size={18} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">입낚 관리자</span>
        </div>
        {sidebarContent}
      </aside>

      {/* 모바일: 햄버거 토글 드로어 */}
      <div className="md:hidden">
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-gray-900 shadow-2xl shadow-black/60 transition-transform duration-300 ease-in-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label="관리자 메뉴"
        >
          <div className="pt-safe flex items-center justify-between px-4 pt-4">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white">
                <Shield size={16} />
              </span>
              <span className="font-extrabold tracking-tight text-white">입낚 관리자</span>
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="메뉴 닫기"
              className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10"
            >
              <X size={19} />
            </button>
          </div>
          {sidebarContent}
        </aside>
      </div>

      {/* 본문 영역 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 모바일 상단 바: 햄버거 버튼만 (슬라이드 메뉴 제거) */}
        <header className="pt-safe sticky top-0 z-30 border-b border-navy-100 bg-[#161616]/90 backdrop-blur-md md:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="관리자 메뉴 열기"
              className="-ml-1.5 rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"
            >
              <Menu size={21} strokeWidth={1.9} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white">
              <Shield size={16} />
            </span>
            <span className="font-extrabold tracking-tight text-navy-800">입낚 관리자</span>
            <button onClick={logout} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 btn-press"><LogOut size={13} /> 로그아웃</button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
