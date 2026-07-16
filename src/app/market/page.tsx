import Link from "next/link";
import { Plus, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CommunityTabs } from "@/components/CommunityTabs";
import { MarketList, type MarketItem } from "@/components/market/MarketList";

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

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-12 z-30 border-b border-navy-100 bg-[#161616]/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3.5">
          <span className="mr-auto text-[19px] font-extrabold tracking-tight text-navy-900">중고피싱</span>
          {user && (
            <Link href="/market/chats" aria-label="채팅" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100">
              <MessageSquare size={21} />
            </Link>
          )}
          <Link href="/market/mine" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-navy-600 transition-colors hover:bg-navy-50">
            내 판매글
          </Link>
        </div>
        <CommunityTabs />
      </header>

      <div className="pt-2">
        <MarketList items={items} />
      </div>

      {/* 글쓰기 FAB */}
      <Link
        href="/market/new"
        className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange-500 px-5 py-3 text-[14px] font-semibold text-white shadow-fab transition-transform active:scale-95 md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
      >
        <Plus size={18} strokeWidth={2.4} /> 판매하기
      </Link>
    </div>
  );
}
