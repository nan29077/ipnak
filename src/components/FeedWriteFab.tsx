"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PenLine, Camera, BookOpen, ShoppingBag, FileText, X } from "lucide-react";

/**
 * 우측 하단 플로팅 글쓰기 버튼(FAB).
 * - 탭하면 글 종류 선택 시트가 뜬다: "피싱 피드 올리기"(사진) / "일반 쓰기"(글).
 * - 시트는 createPortal로 document.body에 렌더링 → 하단 메뉴바(z-40) 위에 항상 표시.
 * - 비로그인 시 /login 으로 유도.
 */
export function FeedWriteFab({ currentUserId }: { currentUserId?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const loggedIn = !!currentUserId;

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      {/* FAB 버튼 — 하단 메뉴 위에 떠 있는 글쓰기 원형 버튼 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 top-0 z-40 mx-auto flex w-full max-w-[760px] justify-center">
        <div className="relative w-full max-w-[640px]">
          <button
            onClick={() => (loggedIn ? setOpen(true) : (window.location.href = "/login"))}
            aria-label="글쓰기"
            className="pointer-events-auto absolute right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-orange-500 shadow-xl shadow-black/40 ring-1 ring-orange-500/40 transition-all hover:bg-[#232323] hover:ring-orange-500/70 active:scale-95 md:bottom-6"
          >
            <PenLine size={24} strokeWidth={2} />
          </button>
        </div>
        <div className="hidden w-[104px] shrink-0 md:block" aria-hidden />
      </div>

      {/* 글쓰기 선택 시트 — createPortal로 body 최상단에 렌더링 (z-[9999] > 하단 메뉴 z-40) */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div
            className="animate-sheet relative w-full max-w-[640px] rounded-t-[20px] border border-navy-100 bg-[#1e1e1e] px-4 pt-3 shadow-sheet"
            style={{ paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-navy-900">무엇을 올릴까요?</h2>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="rounded-full p-1 text-navy-300 hover:bg-navy-50"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/post/new" onClick={() => setOpen(false)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-navy-100 bg-[#242424] p-4 transition-colors hover:border-orange-500/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400"><Camera size={20} /></span>
                <span className="text-[14px] font-bold text-navy-900">피싱 피드</span>
                <span className="text-[12px] leading-snug text-navy-400">사진으로 오늘의 조황을 빠르게 공유</span>
              </Link>
              <Link href="/post/new?type=general" onClick={() => setOpen(false)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-navy-100 bg-[#242424] p-4 transition-colors hover:border-orange-500/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50/20 text-navy-500"><FileText size={20} /></span>
                <span className="text-[14px] font-bold text-navy-900">일반 피드</span>
                <span className="text-[12px] leading-snug text-navy-400">자유롭게 글과 사진을 올려요</span>
              </Link>
              <Link href="/log/new" onClick={() => setOpen(false)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-navy-100 bg-[#242424] p-4 transition-colors hover:border-orange-500/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aqua-500/15 text-aqua-300"><BookOpen size={20} /></span>
                <span className="text-[14px] font-bold text-navy-900">조행기 쓰기</span>
                <span className="text-[12px] leading-snug text-navy-400">제목·본문으로 조행 후기 기록</span>
              </Link>
              <Link href="/market/new" onClick={() => setOpen(false)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-navy-100 bg-[#242424] p-4 transition-colors hover:border-orange-500/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><ShoppingBag size={20} /></span>
                <span className="text-[14px] font-bold text-navy-900">중고 피싱 쓰기</span>
                <span className="text-[12px] leading-snug text-navy-400">낚시 용품을 사고 팔아요</span>
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
