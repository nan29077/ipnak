"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { FavoriteButton } from "@/components/market/FavoriteButton";
import { won } from "@/lib/utils";

// 구매자용 하단 바: 찜 + 가격 + 채팅하기
export function MarketDetailActions({
  listingId, price, status, favorited, favoriteCount,
}: { listingId: string; price: number; status: string; favorited: boolean; favoriteCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function startChat() {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/market/${listingId}/chat`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/market/chats/${data.chatId}`);
    } else {
      toast(data.error || "채팅을 시작할 수 없습니다", "error");
      setBusy(false);
    }
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#161616]/95 p-3 backdrop-blur-md md:relative md:border-0 md:bg-[#1e1e1e]">
      <div className="mx-auto flex max-w-[640px] items-center gap-3">
        <FavoriteButton listingId={listingId} initialFavorited={favorited} initialCount={favoriteCount} variant="bar" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-navy-300">{status === "SOLD" ? "판매완료" : status === "RESERVED" ? "예약중" : "판매가"}</p>
          <p className="truncate text-[17px] font-extrabold text-navy-900">{won(price)}</p>
        </div>
        <button
          onClick={startChat}
          disabled={busy || status === "SOLD"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-600 active:scale-[0.97] disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
          {status === "SOLD" ? "판매완료" : "채팅하기"}
        </button>
      </div>
    </div>
  );
}
