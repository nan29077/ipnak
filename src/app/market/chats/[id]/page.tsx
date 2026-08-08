import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { won } from "@/lib/utils";
import { marketStatusLabel } from "@/lib/taxonomy";
import { MarketChatRoom } from "@/components/market/MarketChatRoom";
import { MarketChatLayout } from "@/components/market/MarketChatLayout";
import { ChatPageHeader } from "@/components/market/ChatPageHeader";
import { NO_IMAGE_SRC } from "@/lib/noImage";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

export default async function MarketChatRoomPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const chat = await prisma.marketChat.findUnique({
    where: { id: params.id },
    include: {
      listing: { include: { images: { orderBy: { order: "asc" }, take: 1 }, seller: { select: { id: true, nickname: true, avatarUrl: true } } } },
      buyer: { select: { id: true, nickname: true, avatarUrl: true } },
    },
  });
  if (!chat) notFound();
  if (chat.buyerId !== user.id && chat.listing.seller.id !== user.id) notFound();

  const amSeller = chat.listing.seller.id === user.id;
  const other = amSeller ? chat.buyer : chat.listing.seller;

  return (
    // MarketChatLayout: visualViewport API로 키보드 등장 시 높이를 동적 조정 → 하단 입력창 항상 키보드 바로 위
    <MarketChatLayout>
      {/* 채팅 전용 헤더 — sticky 없는 순수 shrink-0 flex 아이템 (PageHeader의 sticky top-[52px]가 상품카드 위를 덮는 버그 방지) */}
      <ChatPageHeader nickname={other.nickname} sub={amSeller ? "구매 희망자" : "판매자"} />

      {/* 거래 상품 요약 카드 — 헤더 바로 아래 고정 */}
      <Link
        href={`/market/${chat.listing.id}`}
        className="flex shrink-0 items-center gap-3 border-b border-navy-100/20 bg-[#0d2236] px-3.5 py-3 transition-colors active:bg-navy-50/5"
      >
        {chat.listing.images[0] ? (
          <img
            src={chat.listing.images[0].url}
            alt={chat.listing.title}
            className="h-14 w-14 rounded-xl object-cover shadow-md"
          />
        ) : (
          <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-14 w-14 rounded-xl object-cover shadow-md" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-navy-800">{chat.listing.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[chat.listing.status]}>{marketStatusLabel(chat.listing.status)}</Badge>
            <p className="text-[15px] font-extrabold text-navy-900">{won(chat.listing.price)}</p>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-navy-300" />
      </Link>

      {/* 채팅룸 — flex-1 min-h-0로 남은 공간 전체 차지, 내부에서만 스크롤 */}
      <MarketChatRoom
        chatId={chat.id}
        me={user.id}
        isOwner={amSeller}
        listingId={chat.listingId}
        initialStatus={chat.listing.status}
      />
    </MarketChatLayout>
  );
}
