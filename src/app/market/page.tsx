import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CommunityTabs } from "@/components/CommunityTabs";
import { MarketList, type MarketItem } from "@/components/market/MarketList";
import { MarketSellFab } from "@/components/market/MarketSellFab";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await getCurrentUser();
  const listings = await prisma.marketListing.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { favorites: true, chats: true } },
    },
  });

  const items: MarketItem[] = listings.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
    condition: l.condition,
    price: l.price,
    region: l.region,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    thumbnail: l.images[0]?.url ?? null,
    favoriteCount: l._count.favorites,
    chatCount: l._count.chats,
  }));

  // 답장 필요한 채팅 건수 (판매자 입장)
  let needsReplyCount = 0;
  if (user) {
    const sellerChats = await prisma.marketChat.findMany({
      where: { listing: { sellerId: user.id } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    needsReplyCount = sellerChats.filter(
      (c) => c.messages.length > 0 && c.messages[0].senderId !== user.id && !c.messages[0].body.startsWith("[시스템]")
    ).length;
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-[52px] z-30 border-b border-navy-100 bg-[#0d1b2a]/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3.5">
          <span className="mr-auto text-[19px] font-extrabold tracking-tight text-navy-900">중고피싱</span>
          {user && (
            <Link href="/market/chats" className="relative flex items-center gap-1 rounded-full px-3 py-1.5 text-navy-600 transition-colors hover:bg-navy-50 active:bg-navy-100">
              <MessageSquare size={18} />
              <span className="text-[13px] font-semibold">채팅 목록</span>
              {needsReplyCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-1 ring-[#0d1b2a]">
                  {needsReplyCount > 9 ? "9+" : needsReplyCount}
                </span>
              )}
            </Link>
          )}
        </div>
        <CommunityTabs />
      </header>

      <div className="pt-2">
        <MarketList items={items} />
      </div>

      {/* 판매하기 FAB — prefetch + 클릭 즉시 피드백 */}
      <MarketSellFab />
    </div>
  );
}
