"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import { MARKET_STATUS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

// 판매자 본인용 하단 바: 판매중/예약중/판매완료 전환 + 삭제
export function MarketOwnerActions({ listingId, initialStatus }: { listingId: string; initialStatus: string }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  async function changeStatus(next: string) {
    if (busy || next === status) return;
    setBusy(true);
    const prev = status;
    setStatus(next);
    const res = await fetch(`/api/market/${listingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast("판매 상태를 변경했어요", "success");
      router.refresh();
    } else {
      setStatus(prev);
      toast("상태를 변경하지 못했습니다", "error");
    }
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    if (!confirm("이 판매글을 삭제할까요?")) return;
    setBusy(true);
    const res = await fetch(`/api/market/${listingId}`, { method: "DELETE" });
    if (res.ok) {
      toast("판매글을 삭제했어요", "success");
      router.push("/market/mine");
      router.refresh();
    } else {
      toast("삭제하지 못했습니다", "error");
      setBusy(false);
    }
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#161616]/95 p-3 backdrop-blur-md md:relative md:border-0 md:bg-[#1e1e1e]">
      <div className="mx-auto max-w-[640px]">
        <p className="mb-1.5 text-[11px] font-semibold text-navy-400">판매 상태</p>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-xl bg-navy-50 p-1">
            {MARKET_STATUS.map((s) => (
              <button
                key={s.key}
                onClick={() => changeStatus(s.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[13px] font-semibold transition-all",
                  status === s.key ? "bg-orange-500 text-white shadow-soft" : "text-navy-500 hover:bg-[#1e1e1e]"
                )}
              >
                {status === s.key && <Check size={13} />}{s.label}
              </button>
            ))}
          </div>
          <button
            onClick={remove}
            disabled={busy}
            aria-label="삭제"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-[#1e1e1e] text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
