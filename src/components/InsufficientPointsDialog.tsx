"use client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Coins, CreditCard, Wallet } from "lucide-react";

// 포인트 부족 안내 팝업 — 워킹피드 열람 등 포인트가 부족할 때 표시.
// 앱 다크/낚시 테마(어두운 배경 + 앰버/오렌지 액센트)로 통일.
export function InsufficientPointsDialog({
  open, current, required, onClose, chargeHref = "/me/points/charge",
}: {
  open: boolean;
  current: number;
  required: number;
  onClose: () => void;
  chargeHref?: string;
}) {
  const router = useRouter();
  if (!open || typeof document === "undefined") return null;

  const shortage = Math.max(0, required - current);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-5 backdrop-blur-[3px]">
      <div
        className="w-full max-w-[320px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-amber-400/25"
        style={{ background: "linear-gradient(160deg,#1e1608 0%,#161616 100%)" }}
      >
        {/* 상단 웨이브 스트라이프 */}
        <div className="h-[3px] w-full bg-gradient-to-r from-amber-700/40 via-amber-400 to-orange-500/50" />

        <div className="flex flex-col items-center px-6 pb-5 pt-7">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-amber-400/12 ring-1 ring-amber-400/25">
            <Wallet size={24} strokeWidth={1.7} className="text-amber-300" />
          </div>
          <p className="mt-4 text-center text-[17px] font-bold leading-snug text-white">포인트가 부족합니다</p>
          <p className="mt-1.5 text-center text-[13px] leading-relaxed text-white/50">
            워킹 피드를 열람하려면 포인트가 필요해요.<br />충전 후 다시 시도해주세요.
          </p>

          {/* 보유 / 필요 포인트 */}
          <div className="mt-4 w-full space-y-1.5 rounded-2xl bg-white/[0.05] p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-white/50"><Coins size={13} className="text-white/40" /> 현재 보유</span>
              <span className="font-bold text-white/80 tabular-nums">{current.toLocaleString()}P</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/50">필요 포인트</span>
              <span className="font-bold text-amber-300 tabular-nums">{required.toLocaleString()}P</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1.5 text-[13px]">
              <span className="font-semibold text-white/60">부족한 포인트</span>
              <span className="font-extrabold text-orange-400 tabular-nums">{shortage.toLocaleString()}P</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.07]" />

        {/* 버튼 */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            className="py-4 text-[14px] font-semibold text-white/40 transition-colors active:bg-white/[0.04]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => { onClose(); router.push(chargeHref); }}
            className="flex items-center justify-center gap-1.5 py-4 text-[14px] font-bold text-amber-300 transition-colors active:bg-white/[0.04]"
          >
            <CreditCard size={15} /> 포인트 충전하기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
