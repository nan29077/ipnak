"use client";
import { createPortal } from "react-dom";
import { Fish, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-5 backdrop-blur-[3px]">
      <div
        className={[
          "w-full max-w-[320px] overflow-hidden rounded-[24px] shadow-2xl",
          danger
            ? "ring-1 ring-red-500/20"
            : "ring-1 ring-aqua-500/20",
        ].join(" ")}
        style={{
          background: danger
            ? "linear-gradient(160deg,#1f0d10 0%,#1e1a1e 100%)"
            : "linear-gradient(160deg,#0c1e2e 0%,#172430 100%)",
        }}
      >
        {/* 상단 웨이브 스트라이프 */}
        <div
          className={[
            "h-[3px] w-full",
            danger
              ? "bg-gradient-to-r from-red-700/40 via-red-400 to-red-700/40"
              : "bg-gradient-to-r from-aqua-700/40 via-aqua-400 to-aqua-700/40",
          ].join(" ")}
        />

        {/* 아이콘 + 텍스트 */}
        <div className="flex flex-col items-center px-6 pb-6 pt-7">
          <div
            className={[
              "relative flex h-[60px] w-[60px] items-center justify-center rounded-[18px]",
              danger
                ? "bg-red-500/12 ring-1 ring-red-500/25"
                : "bg-aqua-500/12 ring-1 ring-aqua-500/25",
            ].join(" ")}
          >
            {danger ? (
              <Trash2 size={23} strokeWidth={1.7} className="text-red-400" />
            ) : (
              <Fish size={23} strokeWidth={1.6} className="text-aqua-400" />
            )}
          </div>
          <p className="mt-4 text-center text-[16px] font-bold leading-snug text-white">
            {title}
          </p>
          {message && (
            <p className="mt-2 text-center text-[13px] leading-relaxed text-white/48">
              {message}
            </p>
          )}
        </div>

        {/* 구분선 */}
        <div className="h-px bg-white/[0.07]" />

        {/* 버튼 */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
          <button
            type="button"
            onClick={onCancel}
            className="py-4 text-[14px] font-semibold text-white/40 transition-colors active:bg-white/[0.04]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              "py-4 text-[14px] font-bold transition-colors active:opacity-70",
              danger ? "text-red-400" : "text-aqua-400",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
