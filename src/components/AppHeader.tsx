"use client";
import Link from "next/link";
import Image from "next/image";
import { IconLogin } from "@/components/FishingIcon";
import { NotificationBell } from "@/components/NotificationBell";

// 모든 페이지 상단 공용 헤더 바 (왼쪽 로고 / 오른쪽 알림)
export function AppHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-navy-100 bg-[#161616]/90 backdrop-blur-md">
      <div className="flex h-12 items-center gap-2 px-3.5">
        {/* 로고는 투명 배경이라 다크 헤더에서 글자가 묻힌다 → 흰색 chip 위에 올린다 */}
        <Link href="/" aria-label="입낚 홈" className="flex items-center rounded-lg bg-white px-2 py-1">
          <Image
            src="/logo-ipnak.png"
            alt="입낚"
            width={97}
            height={52}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <div className="ml-auto flex items-center">
          {loggedIn ? (
            <NotificationBell />
          ) : (
            <Link href="/login" aria-label="로그인" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100">
              <IconLogin size={20} strokeWidth={1.9} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
