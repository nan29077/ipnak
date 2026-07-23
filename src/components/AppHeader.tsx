"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { IconLogin } from "@/components/FishingIcon";
import { NotificationBell } from "@/components/NotificationBell";
import { PointsBadge } from "@/components/PointsBadge";
import { SideDrawer, type DrawerUser } from "@/components/SideDrawer";

// 모든 페이지 상단 공용 헤더 바 (왼쪽 햄버거 + 로고 / 오른쪽 [포인트] 알림)
export function AppHeader({
  loggedIn, user = null, shopEnabled = true, reservationEnabled = true, pointsEnabled = false, points = 0,
}: { loggedIn: boolean; user?: DrawerUser; shopEnabled?: boolean; reservationEnabled?: boolean; pointsEnabled?: boolean; points?: number }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
    <header className="pt-safe sticky top-0 z-40 border-b border-navy-100 bg-[#161616]/90 backdrop-blur-md">
      <div className="flex h-[52px] items-center gap-1.5 px-3.5">
        {/* 햄버거: 좌측 전체 메뉴 드로어 (모바일 전용 — PC는 우측 사이드바 사용) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="전체 메뉴 열기"
          className="-ml-1.5 rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100 md:hidden"
        >
          <Menu size={21} strokeWidth={1.9} />
        </button>
        {/* 다크 배경용 로고: 검정 픽셀을 흰색으로 처리한 버전 사용 */}
        <Link href="/" aria-label="입낚 홈" className="flex items-center">
          <Image
            src="/logo-ipnak-dark.png"
            alt="입낚"
            width={97}
            height={52}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {loggedIn ? (
            <>
              <PointsBadge initial={points} initialEnabled={pointsEnabled} />
              <NotificationBell />
            </>
          ) : (
            <Link
              href="/login"
              aria-label="로그인"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[13px] font-semibold text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"
            >
              <IconLogin size={19} strokeWidth={1.9} />
              <span>로그인</span>
            </Link>
          )}
        </div>
      </div>
    </header>
    {/* 드로어는 header 밖에서 렌더링 — header의 backdrop-blur(backdrop-filter)가
        fixed 요소의 containing block을 만들어 드로어가 헤더 높이에 갇히는 문제 방지 */}
    <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} shopEnabled={shopEnabled} reservationEnabled={reservationEnabled} />
    </>
  );
}
