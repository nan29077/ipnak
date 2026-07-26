"use client";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Eye } from "lucide-react";

/**
 * 상품 통계 (관심·채팅·조회)
 * - 서버에서 초기값을 받아 렌더링 후, 클라이언트에서 한 번 더 fetch해 최신값으로 갱신
 * - 관심 토글 시 자동 반영 (window 이벤트 수신)
 */
export function MarketStats({
  listingId,
  initialFavoriteCount,
  initialChatCount,
  initialViewCount,
}: {
  listingId: string;
  initialFavoriteCount: number;
  initialChatCount: number;
  initialViewCount: number;
}) {
  const [favCount, setFavCount] = useState(initialFavoriteCount);
  const [chatCount, setChatCount] = useState(initialChatCount);
  const [viewCount, setViewCount] = useState(initialViewCount);

  // 마운트 시 서버에서 최신 수치를 가져와 갱신
  useEffect(() => {
    fetch(`/api/market/${listingId}/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setFavCount(d.favoriteCount);
        setChatCount(d.chatCount);
        setViewCount(d.viewCount);
      })
      .catch(() => {});
  }, [listingId]);

  // FavoriteButton에서 발행하는 커스텀 이벤트 수신 → 관심 수 즉시 반영
  useEffect(() => {
    function onFavChange(e: Event) {
      const detail = (e as CustomEvent<{ delta: number }>).detail;
      setFavCount((n) => Math.max(0, n + detail.delta));
    }
    window.addEventListener(`market-fav-${listingId}`, onFavChange);
    return () => window.removeEventListener(`market-fav-${listingId}`, onFavChange);
  }, [listingId]);

  return (
    <div className="grid grid-cols-3 divide-x divide-navy-100/20 border-b border-navy-100/20">
      <div className="flex flex-col items-center gap-1 py-3.5">
        <Heart size={20} className="text-red-400" />
        <p className="text-[16px] font-bold text-navy-800">{favCount}</p>
        <p className="text-[11px] text-navy-400">관심</p>
      </div>
      <div className="flex flex-col items-center gap-1 py-3.5">
        <MessageCircle size={20} className="text-aqua-400" />
        <p className="text-[16px] font-bold text-navy-800">{chatCount}</p>
        <p className="text-[11px] text-navy-400">채팅</p>
      </div>
      <div className="flex flex-col items-center gap-1 py-3.5">
        <Eye size={20} className="text-navy-400" />
        <p className="text-[16px] font-bold text-navy-800">{viewCount}</p>
        <p className="text-[11px] text-navy-400">조회</p>
      </div>
    </div>
  );
}
