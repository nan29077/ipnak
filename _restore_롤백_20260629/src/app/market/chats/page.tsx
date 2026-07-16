import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketStatusLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

export default async function MarketChatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const chats = await prisma.marketChat.findMany({
    where: { OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }] },
    orderBy: { updatedAt: "desc" },
    include: {
      listing: { include: { images: { orderBy: { order: "asc" }, take: 1 }, seller: { select: { id: true, nickname: true, avatarUrl: true } } } },
      buyer: { select: { id: true, nickname: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader title="중고거래 채팅" back />
      {chats.length === 0 ? (
        <EmptyState
          title="진행 중인 채팅이 없습니다"
          desc="관심 있는 상품의 판매자와 채팅을 시작해보세요."
          action={<LinkButton href="/market">중고피싱 둘러보기</LinkButton>}
        />
      ) : (
        <div className="divide-y divide-navy-50">
          {chats.map((c) => {
            const amSeller = c.listing.seller.id === user.id;
            const other = amSeller ? c.buyer : c.listing.seller;
            const last = c.messages[0];
            return (
              <Link key={c.id} href={`/market/chats/${c.id}`} className="flex items-center gap-3 bg-[#1e1e1e] px-3.5 py-3 transition-colors hover:bg-navy-50/50">
                <img src={other.avatarUrl || "https://i.pravatar.cc/80"} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-navy-100" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[14px] font-semibold text-navy-900">{other.nickname}</p>
                    <Badge tone={amSeller ? "navy" : "aqua"} className="px-1.5 py-0 text-[10px]">{amSeller ? "구매희망" : "판매자"}</Badge>
                  </div>
                  <p className="truncate text-[13px] text-navy-400">{last ? last.body : "대화를 시작해보세요"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.listing.images[0] && <img src={c.listing.images[0].url} alt={c.listing.title} className="h-11 w-11 rounded-lg object-cover" />}
                  <div className="text-right">
                    <Badge tone={STATUS_TONE[c.listing.status]} className="px-1.5 py-0 text-[10px]">{marketStatusLabel(c.listing.status)}</Badge>
                    <p className="mt-0.5 text-[11px] font-semibold text-navy-700">{won(c.listing.price)}</p>
                    {last && <p className="text-[10px] text-navy-300">{timeAgo(last.createdAt)}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
