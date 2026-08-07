"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  IconHome, IconMap, IconTrophy, IconCalendar, IconTackleBox, IconUser, IconLogin, IconShield, IconRuler,
  IconBook, IconUsers, IconFish,
} from "@/components/FishingIcon";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";
import { RecordingBanner } from "@/components/RecordingBanner";
import { FeedWriteFab } from "@/components/FeedWriteFab";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { UserProvider } from "@/lib/userContext";
import { AppDownloadSheet } from "@/components/AppDownloadSheet";

export type SessionUser = {
  id: string; email: string; nickname: string; role: string; avatarUrl: string | null; points?: number;
} | null;

type NavItemDef = { href: string; label: string; icon: any; match: (p: string) => boolean };

// 모바일 하단 4탭 (+ 중앙 물고기기록 FAB): 커뮤니티 / 스마트피싱 / [●+] / 마켓 / 마이
function buildMobileNav(shopEnabled: boolean): NavItemDef[] {
  return [
    // 커뮤니티 = 커뮤니티 탭(CommunityTabs)에 묶인 모든 피드: 피싱/일상/조행기/워킹/낚시단
    { href: "/feed", label: "커뮤니티", icon: IconUsers, match: (p) => p.startsWith("/feed") || p.startsWith("/general") || p.startsWith("/walking") || p === "/log" || p.startsWith("/log/") || p.startsWith("/groups") || p.startsWith("/explore") },
    { href: "/map", label: "스마트피싱", icon: IconMap, match: (p) => p.startsWith("/map") || p.startsWith("/trip") || p.startsWith("/catch") },
    { href: shopEnabled ? "/shop" : "/market", label: shopEnabled ? "마켓" : "중고 마켓", icon: IconTackleBox, match: (p) => p.startsWith("/market") || p.startsWith("/shop") },
    { href: "/me", label: "마이", icon: IconUser, match: (p) => p === "/me" || p.startsWith("/me/") },
  ];
}

// PC 우측 세로 메뉴: 전체 메뉴 나열 (물고기기록 FAB는 index 2 앞에 삽입)
function buildDesktopNav(shopEnabled: boolean, reservationEnabled: boolean): NavItemDef[] {
  return [
    { href: "/home", label: "홈", icon: IconHome, match: (p) => p === "/" || p === "/home" || p.startsWith("/post") || p.startsWith("/profile") },
    { href: "/map", label: "스마트피싱", icon: IconMap, match: (p) => p.startsWith("/map") || p.startsWith("/trip") || p.startsWith("/catch") },
    // ↑ 여기(인덱스 2 앞)에 물고기기록(측정) FAB 삽입
    { href: "/diary", label: "계측일지", icon: IconFish, match: (p) => p.startsWith("/diary") },
    { href: "/log", label: "조황일지", icon: IconBook, match: (p) => p === "/log" || p.startsWith("/log/") },
    // 조행기(/log)는 위에 별도 항목이 있으므로 제외하고, 나머지 커뮤니티 피드(일상·워킹)를 함께 묶는다
    { href: "/feed", label: "커뮤니티", icon: IconUsers, match: (p) => p.startsWith("/feed") || p.startsWith("/general") || p.startsWith("/walking") || p.startsWith("/groups") || p.startsWith("/explore") },
    { href: "/tournaments", label: "대회", icon: IconTrophy, match: (p) => p.startsWith("/tournaments") },
    ...(reservationEnabled
      ? [{ href: "/reservations", label: "예약", icon: IconCalendar, match: (p: string) => p.startsWith("/reservations") }]
      : []),
    { href: shopEnabled ? "/shop" : "/market", label: shopEnabled ? "마켓" : "중고 마켓", icon: IconTackleBox, match: (p) => p.startsWith("/market") || p.startsWith("/shop") },
    { href: "/me", label: "마이페이지", icon: IconUser, match: (p) => p === "/me" || p.startsWith("/me/") },
  ];
}

// 글쓰기 FAB 숨김 경로 (맵·측정·로그인·관리자 등)
const FAB_HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/admin", "/map", "/measure", "/diary", "/trip", "/catch", "/market"];

export function AppShell({ user, shopEnabled = true, reservationEnabled = true, pointsEnabled = false, pcMarginBg, children }: { user: SessionUser; shopEnabled?: boolean; reservationEnabled?: boolean; pointsEnabled?: boolean; pcMarginBg?: string; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  // 비밀번호 찾기도 로그인·회원가입과 같은 인증 화면이라 앱 헤더/내비 없이 전체 화면으로 보여준다.
  const bare = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password") || pathname.startsWith("/admin") || pathname.startsWith("/print") || pathname.startsWith("/landing") || pathname.startsWith("/about");
  const MOBILE_NAV = buildMobileNav(shopEnabled);
  const DESKTOP_NAV = buildDesktopNav(shopEnabled, reservationEnabled);
  const showFab =
    !bare &&
    !FAB_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  // 앱 안에 있을 때 랜딩 리다이렉트 방지 플래그 설정 (PC/모바일 구분)
  useEffect(() => {
    if (!bare && typeof window !== "undefined") {
      if (window.innerWidth >= 768) {
        sessionStorage.setItem("ipnak_pc_entered", "1");
      } else {
        sessionStorage.setItem("ipnak_mobile_entered", "1");
      }
    }
  }, [bare]);

  if (bare) return <UserProvider user={user}>{children}</UserProvider>;

  return (
    <UserProvider user={user}>
    <div>
      {/* PC 여백 배경: 관리자 설정 이미지(없으면 기본 낚시 풍경) — 데스크톱에서만 */}
      <DesktopPatternBg image={pcMarginBg} />
      {/* 중앙 앱 프레임 + (PC) 우측에 붙는 세로 메뉴를 한 덩어리로 가운데 정렬 */}
      <div className="mx-auto flex w-full max-w-[760px] justify-center md:min-h-screen">
        {/* 본문 (중앙 앱 프레임) — 본문 컬럼은 솔리드 배경으로 패턴을 가려 가독성 유지 */}
        <main className="w-full min-w-0 max-w-[640px] flex-1 pb-24 md:min-h-screen md:bg-[#0d1b2a] md:pb-0 lg:shadow-2xl lg:shadow-black/40">
          <AppHeader loggedIn={!!user} user={user} shopEnabled={shopEnabled} reservationEnabled={reservationEnabled} pointsEnabled={pointsEnabled} points={user?.points ?? 0} />
          <RecordingBanner />
          {children}
          {showFab && <FeedWriteFab currentUserId={user?.id} />}
        </main>

        {/* PC/태블릿: 앱 프레임 바로 오른쪽에 붙는 세로 네비게이션 */}
        <DesktopRightNav pathname={pathname} user={user} nav={DESKTOP_NAV} />
      </div>

      {/* 모바일: 하단 네비게이션 */}
      <MobileBottomNav pathname={pathname} nav={MOBILE_NAV} />

      {/* 모바일 진입 시 앱 다운로드 유도 바텀시트 (랜딩 경로는 컴포넌트 내부에서 제외) */}
      <AppDownloadSheet />
    </div>
    </UserProvider>
  );
}

// 데스크톱(≥1024px) 전용: 앱 프레임 바깥 여백에 실제 바다/낚시 사진을 배경으로 깐다.
// 관리자 설정 이미지(pcMarginBgImage)가 있으면 그것을, 없으면 로컬 배스 앵글러 이미지를
// 기본값으로 사용한다. 사진은 opacity를 낮춰 오버레이처럼 적용해 본문 가독성을 해치지 않고,
// 본문 컬럼은 솔리드 다크(#0d1b2a)라 텍스트 가독성에 영향 없다. 모바일/태블릿(<1024px) 미표시.
const PC_BG_DEFAULT = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지-화이트와펜.png";

function DesktopPatternBg({ image }: { image?: string }) {
  const src = image && image.trim() ? image : PC_BG_DEFAULT;
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden lg:block"
      // 다크 바탕 — 낮은 opacity의 사진 아래에 깔려 앱 프레임(#0d1b2a)과 자연스럽게 이어진다
      style={{ backgroundColor: "#08121e" }}
      aria-hidden
    >
      {/* (1) 사진 레이어: 바다/낚시 사진을 cover로 채우고 opacity를 낮춰 오버레이처럼 적용 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${src}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.72,
        }}
      />
      {/* (2) 옅은 다크 베일 — 사진 톤을 한 단계 가라앉혀 여백이 본문보다 튀지 않게 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,12,18,0.10) 0%, rgba(8,12,18,0.04) 34%, rgba(8,12,18,0.08) 66%, rgba(8,12,18,0.15) 100%)",
        }}
      />
    </div>
  );
}

function MobileBottomNav({ pathname, nav }: { pathname: string; nav: NavItemDef[] }) {
  const NAV = nav;
  const measureActive = pathname.startsWith("/measure") || pathname.startsWith("/diary");
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#0d1b2a]/95 backdrop-blur md:hidden"
      aria-label="하단 메뉴"
    >
      <div className="mx-auto flex max-w-[640px] items-center px-1 pt-1.5">
        {NAV.slice(0, 2).map((n) => (
          <NavItem key={n.href} {...n} active={n.match(pathname)} />
        ))}
        {/* 중앙 원형 + 버튼: 물고기기록(측정) */}
        <div
          className={cn(
            "flex shrink-0 flex-col items-center rounded-xl px-1 pb-1 transition-colors",
            measureActive && "bg-orange-500/15"
          )}
        >
          <Link
            href="/measure"
            aria-current={measureActive ? "page" : undefined}
            className={cn(
              "-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-orange-500 text-gray-900 shadow-lg shadow-orange-500/30 ring-[3px] transition-all active:scale-95",
              measureActive ? "ring-orange-300/70 shadow-orange-500/50" : "ring-[#0d1b2a]"
            )}
            aria-label="AI 측정"
          >
            <svg
              viewBox="60 32 96 132"
              aria-hidden
              className="h-10 w-10"
              fill="none"
            >
              <path
                d="M92 52V118C92 150 138 150 138 116C138 98 118 96 110 110"
                stroke="#161210"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M74 62L92 46L110 62"
                stroke="#161210"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="92" cy="46" r="5" fill="#161210" />
            </svg>
          </Link>
          <span className={cn("mt-0.5 text-[10px] font-semibold", measureActive ? "text-orange-500" : "text-navy-300")}>
            AI측정
          </span>
        </div>
        {NAV.slice(2).map((n) => (
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
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-all duration-200",
        active ? "bg-orange-500/15 text-orange-500" : "text-navy-300"
      )}
    >
      <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function DesktopRightNav({ pathname, user, nav }: { pathname: string; user: SessionUser; nav: NavItemDef[] }) {
  const NAV = nav;
  return (
    <aside className="sticky top-0 hidden h-screen w-[104px] shrink-0 py-4 pl-2 md:flex" aria-label="PC 메뉴">
      {/* 앱 우측에 떠 있는 둥근 다크 패널 */}
      <div className="flex w-full flex-col items-center rounded-[28px] bg-[#122030] py-4 text-white shadow-xl shadow-black/40 ring-1 ring-white/10">
        {/* 메뉴 (항목이 많아도 잘리지 않도록 세로 스크롤 허용) */}
        <nav className="no-scrollbar flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-2" aria-label="메뉴">
          {NAV.slice(0, 2).map((n) => (
            <DesktopNavItem key={n.href} {...n} active={n.match(pathname)} />
          ))}

          {/* 물고기기록 — AI 측정 (주요 액션) */}
          <Link
            href="/measure"
            aria-label="AI 측정"
            aria-current={pathname.startsWith("/measure") ? "page" : undefined}
            className={cn(
              "my-1 flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition-colors active:scale-95",
              pathname.startsWith("/measure") ? "bg-orange-500/15 text-orange-500" : "text-navy-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <IconRuler size={22} strokeWidth={2.4} />
            AI 측정
          </Link>

          {NAV.slice(2).map((n) => (
            <DesktopNavItem key={n.href} {...n} active={n.match(pathname)} />
          ))}
        </nav>

        {/* 계정 */}
        <div className="mt-2 flex w-full flex-col items-center gap-1 px-2">
          <div className="my-1 h-px w-8 bg-white/10" />
          {user ? (
            <>
              {/* 로그아웃 */}
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/";
                }}
                className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-red-400"
                title="로그아웃"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                로그아웃
              </button>
              {/* 프로필 */}
              <Link
                href="/me"
                className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition-colors hover:bg-white/5"
              >
                <img
                  src={getAvatarUrl(user.id, user.avatarUrl)}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white/15"
                />
                <span className="max-w-[84px] truncate text-[10px] font-medium text-white/70">{user.nickname}</span>
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <IconLogin size={20} strokeWidth={1.9} />
              로그인
            </Link>
          )}
          {user?.role === "SUPER_ADMIN" && (
            <Link
              href="/admin"
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <IconShield size={19} strokeWidth={1.9} />
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
        active ? "bg-orange-500/15 text-orange-500" : "text-navy-300 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
