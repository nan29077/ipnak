import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { won } from "@/lib/utils";
import { marketStatusLabel } from "@/lib/taxonomy";
import { MarketChatRoom } from "@/components/market/MarketChatRoom";

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
    <div className="bg-[#1e1e1e]">
      <PageHeader title={other.nickname} back sub={amSeller ? "구매 희망자" : "판매자"} />

      {/* 거래 상품 요약 */}
      <Link href={`/market/${chat.listing.id}`} className="flex items-center gap-3 border-b border-navy-100 bg-navy-50/40 px-3.5 py-2.5">
        {chat.listing.images[0] && <img src={chat.listing.images[0].url} alt={chat.listing.title} className="h-11 w-11 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Badge tone={STATUS_TONE[chat.listing.status]} className="px-1.5 py-0 text-[10px]">{marketStatusLabel(chat.listing.status)}</Badge>
            <p className="truncate text-[13px] font-semibold text-navy-800">{chat.listing.title}</p>
          </div>
          <p className="text-[14px] font-extrabold text-navy-900">{won(chat.listing.price)}</p>
        </div>
        <ChevronRight size={18} className="text-navy-300" />
      </Link>

      <MarketChatRoom chatId={chat.id} me={user.id} />
    </div>
  );
}
