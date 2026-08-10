"use client";
/**
 * 기준물(입낚볼·입낚키링) 미연동 안내 모달
 *
 * AI 측정은 크기를 아는 기준물이 있어야 성립하므로,
 * 연동된 볼·키링이 하나도 없으면 카메라를 열지 않고 이 안내를 먼저 띄운다.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Ruler } from "lucide-react";
import { checkRefLink } from "@/lib/refEquipment";

/** 볼·키링 등록/구매를 함께 제공하는 마이페이지 탭 */
export const REF_REGISTER_HREF = "/me?tab=settings";

export function RefRequiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleKey]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // 카메라 오버레이(z-400대)보다 위에 떠야 한다
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="기준물 등록이 필요합니다"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-[28px] border border-[#253848] bg-[#181818] shadow-[0_-8px_60px_rgba(0,0,0,0.6)] md:rounded-[28px]"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[#3a3a3a]" aria-hidden />
        </div>

        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#888] transition-colors hover:bg-[#2a2a2a] hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center px-7 pt-5">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/20">
            <Ruler size={32} strokeWidth={1.6} className="text-orange-400" />
          </div>

          <h2 className="mb-2 text-center text-[19px] font-black tracking-tight text-white">
            기준물 등록이 필요해요
          </h2>

          <p className="mb-7 text-center text-[13.5px] leading-relaxed text-[#888]">
            입낚볼 또는 입낚키링을 먼저 등록해 주세요.
            <br />
            <span className="text-[#aaa]">AI 측정은 기준물이 필요해요.</span>
          </p>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => { onClose(); router.push(REF_REGISTER_HREF); }}
              className="w-full rounded-xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-[0_4px_20px_rgba(234,179,8,0.35)] transition-all hover:bg-orange-400 active:scale-[0.98]"
            >
              입낚볼 · 키링 등록하러 가기
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-[#333] bg-[#232323] py-3.5 text-[15px] font-bold text-[#aaa] transition-all hover:bg-[#2a2a2a] hover:text-white active:scale-[0.98]"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * AI 측정 진입점에서 기준물 연동을 확인하는 훅.
 *
 *   const { blockIfNoRef, refModal } = useRefRequiredGate();
 *   onClick={async (e) => { e.preventDefault(); if (await blockIfNoRef()) return; router.push("/measure"); }}
 *   ...
 *   {refModal}
 */
export function useRefRequiredGate() {
  const [open, setOpen] = useState(false);

  /** 연동된 기준물이 없으면 안내를 띄우고 true 반환 — 호출부는 이때 진행을 멈춘다 */
  const blockIfNoRef = useCallback(async () => {
    const status = await checkRefLink();
    if (status !== "none") return false; // has / unknown → 통과 (조회 실패로 막지 않는다)
    setOpen(true);
    return true;
  }, []);

  const refModal = <RefRequiredModal open={open} onClose={() => setOpen(false)} />;

  return { blockIfNoRef, refModal };
}
