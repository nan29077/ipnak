"use client";
/**
 * 좌측 슬라이드인 전체 메뉴 드로어 (키득마켓 스타일)
 * - 화면 왼쪽 약 75% 너비 패널 + 오른쪽 반투명 오버레이
 * - 상단: 로고 + X 닫기 / 중단: 그룹별 메뉴(현재 페이지 오렌지 하이라이트)
 * - 하단: 유저 아바타 + 닉네임 + 이메일 + 로그아웃
 */
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  X, Home, Map, Ruler, NotebookPen, BookOpen, Store, ShoppingBag, Newspaper,
  Users, Trophy, CalendarDays, Compass, UserRound, Tag, Settings, LogOut,
  Shield, LogIn, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { getAvatarUrl } from "@/lib/avatarUtils";

export type DrawerUser = {
  id: string; email: string; nickname: string; role: string; avatarUrl: string | null;
} | null;

type Item = { href: string; label: string; icon: any; match?: (p: string) => boolean };

export function SideDrawer({
  open, onClose, user, shopEnabled = true, reservationEnabled = true,
}: { open: boolean; onClose: () => void; user: DrawerUser; shopEnabled?: boolean; reservationEnabled?: boolean }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const toast = useToast();

  // 드로어 열림 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function logout() {
    onClose();
    await fetch("/api/auth/logout", { method: "POST" });
    toast("로그아웃 되었습니다", "success");
    router.push("/login");
    router.refresh();
  }

  const fishing: Item[] = [
    { href: "/", label: "홈", icon: Home, match: (p) => p === "/" },
    { href: "/map", label: "데이터피싱", icon: Map },
    { href: "/measure", label: "물고기기록 (측정)", icon: Ruler },
    { href: "/diary", label: "측정일지", icon: NotebookPen },
    { href: "/log", label: "조행기", icon: BookOpen },
  ];
  const market: Item[] = [
    ...(shopEnabled ? [{ href: "/shop", label: "쇼핑", icon: ShoppingBag } as Item] : []),
    { href: "/market", label: "중고피싱", icon: Store },
  ];
  const community: Item[] = [
    { href: "/feed", label: "피싱 피드", icon: Newspaper },
    { href: "/groups", label: "낚시단", icon: Users },
    { href: "/tournaments", label: "대회", icon: Trophy },
    ...(reservationEnabled ? [{ href: "/reservations", label: "예약", icon: CalendarDays } as Item] : []),
    { href: "/explore", label: "베스트 피드", icon: Compass },
  ];
  const account: Item[] = [
    { href: "/me", label: "마이페이지", icon: UserRound },
    // 쇼핑 메뉴 OFF 시 피싱태그 수익 메뉴 숨김
    ...(shopEnabled ? [{ href: "/referral", label: "피싱태그 수익", icon: Tag } as Item] : []),
  ];

  return (
    <div className={cn("fixed inset-0 z-[9500] md:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      {/* 오른쪽 반투명 오버레이 — 뒤 화면이 살짝 보임, 탭하면 닫힘 */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* 드로어 패널 — 화면 75% 너비, 왼쪽에서 슬라이드인 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className={cn(
          "absolute inset-y-0 left-0 z-10 flex w-[75vw] max-w-[320px] flex-col overflow-hidden",
          "bg-[#161616] shadow-2xl shadow-black/60 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* 상단: 로고 + 닫기 버튼 */}
        <div className="pt-safe border-b border-white/10">
          <div className="flex h-14 items-center justify-between pl-4 pr-3">
            <Link href="/" onClick={onClose} aria-label="입낚 홈" className="flex items-center">
              <Image
                src="/logo-ipnak-dark.png"
                alt="입낚"
                width={97}
                height={52}
                className="h-9 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="메뉴 닫기"
              className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
            >
              <X size={22} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        {/* 메뉴 목록 — 스크롤 가능 */}
        <nav className="no-scrollbar flex-1 overflow-y-auto py-2">
          <MenuGroup title="낚시" items={fishing} pathname={pathname} onClose={onClose} first />
          <MenuGroup title="마켓" items={market} pathname={pathname} onClose={onClose} />
          <MenuGroup title="커뮤니티" items={community} pathname={pathname} onClose={onClose} />
          <div className="mt-2 border-t border-white/10 pt-2">
            <GroupLabel title="내 계정" />
            {account.map((it) => (
              <MenuLink key={it.href} item={it} pathname={pathname} onClose={onClose} />
            ))}
            {user?.role === "SUPER_ADMIN" && (
              <MenuLink
                item={{ href: "/admin", label: "관리자 페이지", icon: Shield }}
                pathname={pathname}
                onClose={onClose}
              />
            )}
            <Link
              href="/settings"
              onClick={onClose}
              className="flex w-full items-center gap-3.5 px-5 py-3 text-left text-[15px] font-medium text-white/80 transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <Settings size={20} strokeWidth={1.8} />
              입낚볼/설정
            </Link>
          </div>
        </nav>

        {/* 하단: 유저 프로필 + 로그아웃 */}
        <div className="pb-safe border-t border-white/10">
          {user ? (
            <>
              <Link
                href="/me"
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/5 active:bg-white/10"
              >
                <img
                  src={getAvatarUrl(user.id, user.avatarUrl)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/15"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-white">{user.nickname}</span>
                  <span className="block truncate text-[11px] text-white/50">{user.email}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-white/40" />
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3.5 px-5 pb-4 pt-1 text-left text-[13px] font-medium text-white/60 transition-colors hover:text-red-400"
              >
                <LogOut size={18} strokeWidth={1.8} />
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="flex w-full items-center gap-3.5 px-5 py-4 text-[15px] font-semibold text-orange-400 transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <LogIn size={20} strokeWidth={1.9} />
              로그인 / 회원가입
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

function GroupLabel({ title }: { title: string }) {
  return (
    <p className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
      {title}
    </p>
  );
}

function MenuGroup({
  title, items, pathname, onClose, first = false,
}: { title: string; items: Item[]; pathname: string; onClose: () => void; first?: boolean }) {
  return (
    <div className={first ? "" : "mt-2 border-t border-white/10 pt-2"}>
      <GroupLabel title={title} />
      {items.map((it) => (
        <MenuLink key={it.href} item={it} pathname={pathname} onClose={onClose} />
      ))}
    </div>
  );
}

function MenuLink({ item, pathname, onClose }: { item: Item; pathname: string; onClose: () => void }) {
  const Icon = item.icon;
  const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3.5 px-5 py-3 text-[15px] font-medium transition-colors",
        active
          ? "bg-orange-500 text-white"
          : "text-white/80 hover:bg-white/5 active:bg-white/10"
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.1 : 1.8} />
      {item.label}
    </Link>
  );
}
