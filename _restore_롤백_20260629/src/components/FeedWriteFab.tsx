"use client";
import Link from "next/link";
import { PenLine } from "lucide-react";

/**
 * 메인 피드 우측 하단 플로팅 글쓰기 버튼(FAB).
 * - AppShell 프레임(외곽 760 / 본문 640 / PC 네비 104)을 그대로 복제해
 *   본문 컬럼 우측 끝에 정확히 정렬된다.
 * - 모바일: 하단 네비 위로 띄우고 safe-area 고려.
 * - 비로그인 시 /login 으로 유도.
 */
export function FeedWriteFab({ currentUserId }: { currentUserId?: string }) {
  const href = currentUserId ? "/post/new" : "/login";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 top-0 z-40 mx-auto flex w-full max-w-[760px] justify-center">
      {/* 본문 컬럼과 동일 폭 */}
      <div className="relative w-full max-w-[640px]">
        <Link
          href={href}
          aria-label="피드 글쓰기"
          className="pointer-events-auto absolute right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-orange-500 shadow-xl shadow-black/40 ring-1 ring-orange-500/40 transition-all hover:bg-[#232323] hover:ring-orange-500/70 active:scale-95 md:bottom-6"
        >
          <PenLine size={24} strokeWidth={2} />
        </Link>
      </div>
      {/* PC 네비 자리(104px) 만큼 비워 본문 우측 정렬 유지 */}
      <div className="hidden w-[104px] shrink-0 md:block" aria-hidden />
    </div>
  );
}
