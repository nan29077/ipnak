"use client";
/**
 * 입낚볼 ID 수동 입력 컴포넌트
 * - NFC 미지원 기기(iPhone 등)에서 볼 ID를 직접 입력해 등록
 * - 볼에 인쇄된 ID 또는 박스에 표기된 시리얼 번호를 입력
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/Toast";

export function BallManualInput({ onRegistered }: { onRegistered?: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ballId, setBallId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = ballId.trim();
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/balls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ballId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "등록에 실패했어요.", "error");
        return;
      }
      const data = await res.json();
      if (data.alreadyLinked) {
        toast(`이미 등록된 볼입니다 (${id})`, "info");
      } else {
        toast(`입낚볼(${id}) 등록 완료`, "success");
      }
      setBallId("");
      setOpen(false);
      onRegistered?.();
      router.refresh();
    } catch {
      toast("네트워크 오류가 발생했어요.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        <span className="flex items-center gap-2.5 text-[13px] font-medium text-white/60">
          <Hash size={15} strokeWidth={1.8} className="text-white/40" />
          볼 ID 직접 입력 (NFC 미지원 기기)
        </span>
        {open ? (
          <ChevronUp size={14} className="shrink-0 text-white/30" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-white/30" />
        )}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-white/10 px-4 pb-4 pt-3">
          <p className="mb-2.5 text-[12px] text-white/40">
            입낚볼 제품 박스 또는 볼 표면에 인쇄된 ID를 입력해 주세요.
          </p>
          <div className="flex gap-2">
            <input
              value={ballId}
              onChange={(e) => setBallId(e.target.value)}
              placeholder="예: IPNAK-2024-XXXX"
              maxLength={64}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
            <button
              type="submit"
              disabled={!ballId.trim() || loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              등록
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
