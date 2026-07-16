"use client";
import Link from "next/link";
import { Anchor, LogIn } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

// 모든 페이지 상단 공용 헤더 바 (왼쪽 로고 / 오른쪽 알림)
export function AppHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-navy-100 bg-[#161616]/90 backdrop-blur-md">
      <div className="flex h-12 items-center gap-2 px-3.5">
        <Link href="/" aria-label="입낚 홈" className="flex items-center gap-1.5">
          <Anchor className="text-orange-500" size={20} strokeWidth={2.2} />
          <span className="text-[18px] font-extrabold tracking-tight text-navy-900">입낚</span>
        </Link>
        <div className="ml-auto flex items-center">
          {loggedIn ? (
            <NotificationBell />
          ) : (
            <Link href="/login" aria-label="로그인" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100">
              <LogIn size={20} strokeWidth={1.9} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
