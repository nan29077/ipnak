import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketStatusLabel } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { NO_IMAGE_SRC } from "@/lib/noImage";

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
      listing: {
        include: {
          images: { orderBy: { order: "asc" }, take: 1 },
          seller: { select: { id: true, nickname: true, avatarUrl: true } },
        },
      },
      buyer: { select: { id: true, nickname: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="bg-[#0d1b2a]">
      <PageHeader title="채팅" back sub={chats.length > 0 ? `${chats.length}개` : undefined} />

      {chats.length === 0 ? (
        <EmptyState
          title="진행 중인 채팅이 없습니다"
          desc="관심 있는 상품의 판매자와 채팅을 시작해보세요."
          action={<LinkButton href="/market">중고마켓 둘러보기</LinkButton>}
        />
      ) : (
        <div className="divide-y divide-navy-100/10">
          {chats.map((c) => {
            const amSeller = c.listing.seller.id === user.id;
            const other = amSeller ? c.buyer : c.listing.seller;
            const last = c.messages[0];
            const isSystem = last?.body.startsWith("[시스템]");
            const displayMsg = isSystem
              ? last.body.replace("[시스템] ", "")
              : last?.body;

            // 답장 필요 여부: 상대방이 마지막 메시지를 보냈고 시스템 메시지가 아닌 경우
            const needsReply = last && !isSystem && last.senderId !== user.id;

            return (
              <Link
                key={c.id}
                href={`/market/chats/${c.id}`}
                className={`flex items-center gap-3 px-3.5 py-3.5 transition-colors active:bg-navy-50/5 ${needsReply ? "bg-[#1a2c40] border-l-2 border-amber-400" : "bg-[#162538]"}`}
              >
                {/* 상대방 아바타 */}
                <div className="relative shrink-0">
                  <img
                    src={getAvatarUrl(other.id, other.avatarUrl)}
                    alt={other.nickname}
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-navy-100/20"
                  />
                  {needsReply && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-[#1a2c40]" />
                  )}
                </div>

                {/* 채팅 내용 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[14px] font-semibold text-navy-900 truncate">{other.nickname}</p>
                    <span className={`shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold ${amSeller ? "bg-orange-500/15 text-orange-400" : "bg-aqua-400/15 text-aqua-400"}`}>
                      {amSeller ? "판매 상품" : "구매 상품"}
                    </span>
                  </div>
                  <p className="text-[13px] text-navy-800 truncate">{c.listing.title}</p>
                  <p className={`text-[12px] truncate mt-0.5 ${isSystem ? "italic text-navy-300" : needsReply ? "font-semibold text-amber-300" : "text-navy-400"}`}>
                    {displayMsg ?? "대화를 시작해보세요"}
                  </p>
                </div>

                {/* 상품 썸네일 + 상태 + 가격 + 시간 */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {last && (
                    <p className="text-[10px] text-navy-300 mb-0.5">{timeAgo(last.createdAt)}</p>
                  )}
                  {c.listing.images[0] ? (
                    <div className="relative">
                      <img
                        src={c.listing.images[0].url}
                        alt={c.listing.title}
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                      <div className="absolute -top-1.5 -right-1.5">
                        <Badge tone={STATUS_TONE[c.listing.status]}>{marketStatusLabel(c.listing.status)}</Badge>
                      </div>
                    </div>
                  ) : (
                    <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-14 w-14 rounded-xl object-cover" />
                  )}
                  <p className="text-[12px] font-bold text-navy-800">{won(c.listing.price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
