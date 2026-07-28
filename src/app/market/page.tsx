import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MarketList, type MarketItem } from "@/components/market/MarketList";
import { MarketSellFab } from "@/components/market/MarketSellFab";
import { MarketTabs } from "@/components/market/MarketTabs";
import { MarketIntroBanner } from "@/components/market/MarketIntroBanner";
import { BassOnlyBanner } from "@/components/BassOnlyBanner";
import { MarketSearchButton } from "@/components/market/MarketSearchButton";
import { getBoolSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  // 쇼핑 메뉴 노출 OFF: 쇼핑 탭이 없으므로 제목을 "중고 마켓"으로 표시
  // 서로 독립적인 조회 3개 병렬화 (결과 동일)
  const [user, shopEnabled, listings] = await Promise.all([
    getCurrentUser(),
    getBoolSetting("shop_menu_enabled"),
    prisma.marketListing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        _count: { select: { favorites: true, chats: true } },
      },
    }),
  ]);

  const items: MarketItem[] = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    category: listing.category,
    condition: listing.condition,
    price: listing.price,
    region: listing.region,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    thumbnail: listing.images[0]?.url ?? null,
    favoriteCount: listing._count.favorites,
    chatCount: listing._count.chats,
  }));

  let needsReplyCount = 0;
  if (user) {
    const sellerChats = await prisma.marketChat.findMany({
      where: { listing: { sellerId: user.id } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    needsReplyCount = sellerChats.filter(
      (chat) =>
        chat.messages.length > 0 &&
        chat.messages[0].senderId !== user.id &&
        !chat.messages[0].body.startsWith("[시스템]")
    ).length;
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-[52px] z-30 border-b border-navy-100 bg-[#0d1b2a]/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3.5">
          <span className="shrink-0 text-[19px] font-extrabold tracking-tight text-navy-900">
            {shopEnabled ? "마켓" : "중고 마켓"}
          </span>
          <MarketSearchButton />
          {user && (
            <Link
              href="/market/chats"
              className="relative flex items-center gap-1 rounded-full px-3 py-1.5 text-navy-600 transition-colors hover:bg-navy-50 active:bg-navy-100"
            >
              <MessageSquare size={18} />
              <span className="hidden text-[13px] font-semibold sm:inline">채팅 목록</span>
              {needsReplyCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-1 ring-[#0d1b2a]">
                  {needsReplyCount > 9 ? "9+" : needsReplyCount}
                </span>
              )}
            </Link>
          )}
        </div>
        <MarketTabs />
      </header>

      <div className="pt-4">
        <MarketIntroBanner variant="used" />
        <BassOnlyBanner
          text="배스낚시 전용 모드 — 배스 장비 위주로 둘러보세요"
          className="mx-4 mb-4"
        />
        <MarketList items={items} />
      </div>

      <MarketSellFab />
    </div>
  );
}
