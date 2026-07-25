"use client";
import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  /** 어떤 기능을 이용하려 했는지 (선택) */
  feature?: string;
}

export function LoginRequiredModal({ open, onClose, feature }: LoginRequiredModalProps) {
  const router = useRouter();

  // ESC 키로 닫기
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    // 배경 스크롤 방지
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleKey]);

  if (!open) return null;

  const featureText = feature ?? "이 기능";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="로그인이 필요합니다"
    >
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* 모달 카드 */}
      <div
        className="
          relative z-10 w-full max-w-sm overflow-hidden
          rounded-t-[28px] md:rounded-[28px]
          border border-[#253848]
          bg-[#181818]
          shadow-[0_-8px_60px_rgba(0,0,0,0.6)]
        "
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* 상단 핸들 (모바일 바텀시트 스타일) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[#3a3a3a]" aria-hidden />
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="
            absolute right-4 top-4 rounded-full p-1.5
            text-[#888] hover:bg-[#2a2a2a] hover:text-white
            transition-colors
          "
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center px-7 pb-0 pt-5">
          {/* 낚시 아이콘 일러스트 */}
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/20">
            <FishHookSvg />
          </div>

          {/* 제목 */}
          <h2 className="mb-2 text-center text-[19px] font-black text-white tracking-tight">
            로그인이 필요해요
          </h2>

          {/* 설명 */}
          <p className="mb-7 text-center text-[13.5px] leading-relaxed text-[#888]">
            {featureText}은(는) 로그인 후 이용할 수 있어요.
            <br />
            <span className="text-[#aaa]">계정이 없다면 지금 바로 가입하세요!</span>
          </p>

          {/* 버튼 영역 */}
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => { onClose(); router.push("/login"); }}
              className="
                w-full rounded-xl py-3.5 text-[15px] font-bold
                bg-orange-500 text-white
                shadow-[0_4px_20px_rgba(234,179,8,0.35)]
                active:scale-[0.98] transition-all
                hover:bg-orange-400
              "
            >
              로그인하러 가기
            </button>
            <button
              onClick={() => { onClose(); router.push("/signup"); }}
              className="
                w-full rounded-xl py-3.5 text-[15px] font-bold
                bg-[#232323] text-[#aaa]
                border border-[#333]
                active:scale-[0.98] transition-all
                hover:bg-[#2a2a2a] hover:text-white
              "
            >
              회원가입하기
            </button>
          </div>

          {/* 하단 구분선 텍스트 */}
          <div className="mt-5 mb-1 flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-[11px] text-[#555]">입낚 — 낚시인의 모든 순간을 기록하다</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** 낚시 훅 SVG 아이콘 (라인형) */
function FishHookSvg() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* 낚싯대 라인 */}
      <line x1="18" y1="2" x2="18" y2="16" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
      {/* 낚싯줄 */}
      <line x1="18" y1="16" x2="22" y2="16" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
      {/* 훅 */}
      <path
        d="M22 16 C22 16, 28 16, 28 22 C28 28, 22 28, 22 26"
        stroke="#eab308"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 훅 포인트 */}
      <path
        d="M22 26 L19 24"
        stroke="#eab308"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* 작은 물고기 */}
      <ellipse cx="12" cy="28" rx="5" ry="3" stroke="#eab308" strokeWidth="1.5" fill="none" />
      <path d="M7 28 L5 25 L5 31 Z" stroke="#eab308" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="27.5" r="0.8" fill="#eab308" />
    </svg>
  );
}

/**
 * 비로그인 상태에서 클릭을 가로채는 래퍼 훅
 *
 * 사용법:
 * const { modal, requireLogin } = useRequireLogin();
 * <button onClick={requireLogin(handleClick)}>좋아요</button>
 * {modal}
 */
import { useState } from "react";

export function useRequireLogin(loggedIn: boolean, feature?: string) {
  const [open, setOpen] = useState(false);

  function requireLogin<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      if (!loggedIn) {
        setOpen(true);
        return;
      }
      return fn(...args);
    }) as T;
  }

  const modal = (
    <LoginRequiredModal open={open} onClose={() => setOpen(false)} feature={feature} />
  );

  return { requireLogin, modal, openModal: () => setOpen(true) };
}
