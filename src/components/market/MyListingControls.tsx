"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { MARKET_STATUS } from "@/lib/taxonomy";
import { Select } from "@/components/ui";

// 내 판매글 목록의 개별 관리 컨트롤: 상태 변경 + 삭제
export function MyListingControls({ listingId, initialStatus }: { listingId: string; initialStatus: string }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    setBusy(true);
    const prev = status;
    setStatus(next);
    const res = await fetch(`/api/market/${listingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
    });
    if (res.ok) { toast("상태를 변경했어요", "success"); router.refresh(); }
    else { setStatus(prev); toast("변경 실패", "error"); }
    setBusy(false);
  }

  async function remove() {
    if (!confirm("이 판매글을 삭제할까요?")) return;
    setBusy(true);
    const res = await fetch(`/api/market/${listingId}`, { method: "DELETE" });
    if (res.ok) { toast("삭제했어요", "success"); router.refresh(); }
    else { toast("삭제 실패", "error"); setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Select
        value={status}
        onChange={(e) => change(e.target.value)}
        disabled={busy}
        className="w-auto rounded-lg py-1.5 text-[12px]"
      >
        {MARKET_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </Select>
      <button
        onClick={remove}
        disabled={busy}
        aria-label="삭제"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-[#1e1e1e] text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
