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
  SELLING: "aqua",
  RESERVED: "amber",
  SOLD: "gray",
};

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const chats = await prisma.marketChat.findMany({
    where: { buyerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      listing: {
        include: {
          images: { take: 1, orderBy: { order: "asc" } },
          seller: { select: { id: true, nickname: true, avatarUrl: true } },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="bg-surface">
      <PageHeader title="구매내역" back sub={`총 ${chats.length}개`} />

      {chats.length === 0 ? (
        <EmptyState
          title="구매 내역이 없습니다"
          desc="관심 상품의 판매자에게 채팅을 보내 거래를 시작해보세요."
          action={<LinkButton href="/market">중고마켓 둘러보기</LinkButton>}
        />
      ) : (
        <div className="divide-y divide-navy-50">
          {chats.map((c) => {
            const { listing: l } = c;
            const isSold = l.status === "SOLD";
            const lastMsg = c.messages[0];

            return (
              <Link
                key={c.id}
                href={`/market/chats/${c.id}`}
                className="flex items-center gap-3 bg-[#162538] px-3.5 py-3.5 transition-colors hover:bg-navy-50/50"
              >
                {/* 썸네일 */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                  {l.images[0] ? (
                    <img
                      src={l.images[0].url}
                      alt={l.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-full w-full object-cover" />
                  )}
                  {isSold && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-[10px] font-bold text-white">판매완료</span>
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[l.status] ?? "gray"} className="px-1.5 py-0 text-[10px]">
                      {marketStatusLabel(l.status)}
                    </Badge>
                    <span className="text-[11px] text-navy-300">{l.seller.nickname}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[14px] font-semibold text-navy-900">
                    {l.title}
                  </p>
                  <p className="text-[13px] font-bold text-navy-800">{won(l.price)}</p>
                  <p className="mt-0.5 line-clamp-1 text-[12px] text-navy-400">
                    {lastMsg ? lastMsg.body : "대화를 시작해보세요"}
                  </p>
                </div>

                {/* 판매자 아바타 + 시간 */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <img
                    src={getAvatarUrl(l.seller.id, l.seller.avatarUrl)}
                    alt={l.seller.nickname}
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-navy-100"
                  />
                  {lastMsg && (
                    <span className="text-[10px] text-navy-300">
                      {timeAgo(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
