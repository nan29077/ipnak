"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Trophy, CalendarDays, User, Plus, Anchor, ShoppingBag, LogIn, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionUser = {
  id: string; email: string; nickname: string; role: string; avatarUrl: string | null;
} | null;

const NAV = [
  { href: "/", label: "홈", icon: Home, match: (p: string) => p === "/" || p.startsWith("/feed") || p.startsWith("/post") || p.startsWith("/profile") },
  { href: "/map", label: "지도", icon: Map, match: (p: string) => p.startsWith("/map") || p.startsWith("/trip") || p.startsWith("/catch") },
  { href: "/tournaments", label: "대회", icon: Trophy, match: (p: string) => p.startsWith("/tournaments") },
  { href: "/reservations", label: "예약", icon: CalendarDays, match: (p: string) => p.startsWith("/reservations") },
  { href: "/shop", label: "쇼핑", icon: ShoppingBag, match: (p: string) => p.startsWith("/shop") },
  { href: "/me", label: "마이", icon: User, match: (p: string) => p.startsWith("/me") },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const bare = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/admin");

  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen">
      {/* 중앙 앱 프레임 + (PC) 우측에 붙는 세로 메뉴를 한 덩어리로 가운데 정렬 */}
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] justify-center">
        {/* 본문 (중앙 앱 프레임) */}
        <main className="min-h-screen w-full min-w-0 max-w-[640px] flex-1 pb-24 md:pb-0">
          {children}
        </main>

        {/* PC/태블릿: 앱 프레임 바로 오른쪽에 붙는 세로 네비게이션 */}
        <DesktopRightNav pathname={pathname} user={user} />
      </div>

      {/* 모바일: 하단 네비게이션 */}
      <MobileBottomNav pathname={pathname} />
    </div>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/95 backdrop-blur md:hidden"
      aria-label="하단 메뉴"
    >
      <div className="mx-auto flex max-w-[640px] items-center px-1 pt-1.5">
        {NAV.slice(0, 3).map((n) => (
          <NavItem key={n.href} {...n} active={n.match(pathname)} />
        ))}
        <div className="flex shrink-0 justify-center px-1">
          <Link
            href="/catch/new"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-navy-700 text-white shadow-lg shadow-navy-700/30 ring-4 ring-white transition-transform active:scale-95"
            aria-label="잡은 물고기 기록하기"
          >
            <Plus size={26} />
          </Link>
        </div>
        {NAV.slice(3, 6).map((n) => (
          <NavItem key={n.href} {...n} active={n.match(pathname)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-all duration-200",
        active ? "bg-navy-50 text-navy-700" : "text-navy-300"
      )}
    >
      <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function DesktopRightNav({ pathname, user }: { pathname: string; user: SessionUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[104px] shrink-0 py-4 pl-2 md:flex" aria-label="PC 메뉴">
      {/* 앱 우측에 떠 있는 둥근 다크 패널 */}
      <div className="flex w-full flex-col items-center rounded-[28px] bg-navy-900 py-4 text-white shadow-xl shadow-navy-900/25 ring-1 ring-white/10">
        {/* 브랜드 */}
        <Link
          href="/"
          aria-label="입낚 홈"
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-aqua-300 transition-colors hover:bg-white/15"
        >
          <Anchor size={22} strokeWidth={2} />
        </Link>

        {/* 메뉴 */}
        <nav className="flex w-full flex-1 flex-col items-center gap-1 px-2" aria-label="메뉴">
          {NAV.slice(0, 3).map((n) => (
            <DesktopNavItem key={n.href} {...n} active={n.match(pathname)} />
          ))}

          {/* 기록하기 (주요 액션) */}
          <Link
            href="/catch/new"
            aria-label="잡은 물고기 기록하기"
            className="my-1 flex w-full flex-col items-center gap-1 rounded-2xl bg-aqua-500 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-aqua-500/25 transition-transform hover:bg-aqua-400 active:scale-95"
          >
            <Plus size={22} strokeWidth={2.4} />
            기록
          </Link>

          {NAV.slice(3).map((n) => (
            <DesktopNavItem key={n.href} {...n} active={n.match(pathname)} />
          ))}
        </nav>

        {/* 계정 */}
        <div className="mt-2 flex w-full flex-col items-center gap-1 px-2">
          <div className="my-1 h-px w-8 bg-white/10" />
          {user ? (
            <Link
              href="/me"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition-colors hover:bg-white/5"
            >
              <img
                src={user.avatarUrl || "https://i.pravatar.cc/80"}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white/15"
              />
              <span className="max-w-[84px] truncate text-[10px] font-medium text-navy-200">{user.nickname}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogIn size={20} strokeWidth={1.9} />
              로그인
            </Link>
          )}
          {user?.role === "SUPER_ADMIN" && (
            <Link
              href="/admin"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Shield size={19} strokeWidth={1.9} />
              관리자
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

function DesktopNavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition-all duration-200",
        active ? "bg-white/10 text-aqua-300" : "text-navy-300 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
