"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2, Clock } from "lucide-react";
import { useToast } from "@/components/Toast";
import { FavoriteButton } from "@/components/market/FavoriteButton";
import { won } from "@/lib/utils";

export function MarketDetailActions({
  listingId, price, status, favorited, favoriteCount,
}: {
  listingId: string;
  price: number;
  status: string;
  favorited: boolean;
  favoriteCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [existingChatId, setExistingChatId] = useState<string | null>(null);

  // 페이지 마운트 시 기존 채팅방 조회 (있으면 즉시 이동 가능)
  useEffect(() => {
    fetch(`/api/market/${listingId}/chat`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.chatId) setExistingChatId(d.chatId); })
      .catch(() => {});
  }, [listingId]);

  async function startChat() {
    if (busy) return;
    setBusy(true);
    // 이미 채팅방이 있으면 API 호출 없이 즉시 이동
    if (existingChatId) {
      router.push(`/market/chats/${existingChatId}`);
      return;
    }
    const res = await fetch(`/api/market/${listingId}/chat`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/market/chats/${data.chatId}`);
    } else {
      toast(data.error || "채팅을 시작할 수 없습니다", "error");
      setBusy(false);
    }
  }

  const isSold = status === "SOLD";
  const isReserved = status === "RESERVED";

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-navy-100/20 bg-[#0d1b2a]/95 backdrop-blur-md">
      {/* 예약중 안내 배너 */}
      {isReserved && (
        <div className="flex items-center justify-center gap-1.5 border-b border-amber-400/20 bg-amber-400/10 py-2">
          <Clock size={13} className="text-amber-400" />
          <p className="text-[12px] font-semibold text-amber-400">예약중인 상품입니다 · 채팅으로 문의 가능해요</p>
        </div>
      )}
      <div className="mx-auto flex max-w-[640px] items-center gap-3 p-3">
        <FavoriteButton listingId={listingId} initialFavorited={favorited} initialCount={favoriteCount} variant="bar" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-navy-300">
            {isSold ? "판매완료" : isReserved ? "예약중" : "판매가"}
          </p>
          <p className="truncate text-[17px] font-extrabold text-navy-900">{won(price)}</p>
        </div>
        <button
          onClick={startChat}
          disabled={busy || isSold}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white shadow-soft transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: isSold ? "#374151" : isReserved ? "#d97706" : "#f97316" }}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <MessageCircle size={18} />
          )}
          {isSold ? "판매완료" : isReserved ? "채팅하기" : "채팅하기"}
        </button>
      </div>
    </div>
  );
}
