"use client";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Smartphone, Download, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";

/** 같은 세션 내 재노출 방지용 sessionStorage 키 */
const DISMISS_KEY = "ipnak_app_sheet_dismissed";

/**
 * 모바일 진입 시 하단에서 올라오는 앱 다운로드 유도 바텀시트.
 *
 * - 랜딩(/landing) 경로에서는 절대 표시하지 않는다.
 * - "모바일로 계속" 또는 "앱 다운로드"(준비 중) 중 하나를 선택하거나
 *   오버레이를 클릭해 닫으면 sessionStorage에 기록하여 같은 세션 내 재진입 시 다시 뜨지 않는다.
 * - 앱 출시 시 확장 포인트: 버튼2 클릭에서 Android → Play Store / iOS → App Store 로 이동.
 */
export function AppDownloadSheet() {
  const pathname = usePathname() || "/";
  const toast = useToast();
  const isNativeApp = useIsNativeApp();
  const [open, setOpen] = useState(false);
  // 슬라이드 인/아웃 트랜지션 제어 (true=올라온 상태, false=아래로 내려간 상태)
  const [shown, setShown] = useState(false);

  const isLanding = pathname.startsWith("/landing");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 랜딩 경로에서는 노출 금지
    if (isLanding) return;
    // 네이티브 앱(패키징된 Android/iOS)에서는 표시 안 함
    if (isNativeApp) return;
    // 이미 이번 세션에서 선택함 → 표시 안 함
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    // 모바일 판별: 뷰포트 너비(앱 컨벤션 <768) 또는 모바일 UA (PC는 이미 md:hidden CSS로 숨김)
    const ua = navigator.userAgent || "";
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isMobile = window.innerWidth < 768 || isMobileUa;
    if (!isMobile) return;

    // 진입 직후 살짝 지연을 두어 자연스럽게 올라오게 한다
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [isLanding, isNativeApp]);

  // open 이 되면 다음 프레임에 shown=true 로 전환해 슬라이드 업 트랜지션을 발동
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  // 닫기 = "모바일로 계속" 선택과 동일: 세션 저장 후 슬라이드 아웃
  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private 모드 등에서 실패해도 무시 */
    }
    setShown(false); // 아래로 슬라이드
    setTimeout(() => setOpen(false), 240); // 트랜지션 후 언마운트
  }, []);

  // 앱 다운로드: 현재는 준비 중 안내. (확장 포인트)
  const handleDownload = useCallback(() => {
    // ── 앱 등록 후 확장 지점 ──────────────────────────────
    // const ua = navigator.userAgent || "";
    // if (/Android/i.test(ua)) { window.location.href = PLAY_STORE_URL; return; }
    // if (/iPhone|iPad|iPod/i.test(ua)) { window.location.href = APP_STORE_URL; return; }
    // ────────────────────────────────────────────────────
    toast("준비 중입니다. 앱 출시 후 이용 가능해요.", "info");
    // 안내 후 시트는 닫고 세션 내 재노출 방지 (요구사항: 선택 시 다시 안 뜸)
    dismiss();
  }, [toast, dismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="입낚 앱 안내"
    >
      {/* 배경 dim 오버레이 — 클릭 시 닫기(모바일로 계속과 동일) */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={dismiss}
      />

      {/* 시트 카드 — 아래에서 올라옴 */}
      <div
        className={`relative z-10 w-full max-w-[640px] overflow-hidden rounded-t-[28px] border border-[#253848] bg-[#181818] shadow-[0_-8px_60px_rgba(0,0,0,0.6)] transition-transform duration-[240ms] ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* 상단 핸들 */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-[#3a3a3a]" aria-hidden />
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#888] transition-colors hover:bg-[#2a2a2a] hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center px-7 pt-5">
          {/* 아이콘 (라인형) */}
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/20">
            <Smartphone size={34} strokeWidth={1.7} className="text-orange-500" />
          </div>

          {/* 제목 */}
          <h2 className="mb-2 text-center text-[19px] font-black tracking-tight text-white">
            입낚 앱으로 더 편하게!
          </h2>

          {/* 설명 */}
          <p className="mb-7 text-center text-[13.5px] leading-relaxed text-[#888]">
            앱에서는 더 빠르고 편하게
            <br />
            낚시의 모든 순간을 기록할 수 있어요.
          </p>

          {/* 버튼 영역 */}
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={handleDownload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-[0_4px_20px_rgba(234,179,8,0.35)] transition-all hover:bg-orange-400 active:scale-[0.98]"
            >
              <Download size={18} strokeWidth={2.1} />
              앱 다운로드 받으러 가기
            </button>
            <button
              onClick={dismiss}
              className="w-full rounded-xl border border-[#333] bg-[#232323] py-3.5 text-[15px] font-bold text-[#aaa] transition-all hover:bg-[#2a2a2a] hover:text-white active:scale-[0.98]"
            >
              모바일로 계속 볼래요
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
