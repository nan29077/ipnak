import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, MessageCircle, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketStatusLabel, marketCategoryLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua",
  RESERVED: "amber",
  SOLD: "gray",
};

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const favorites = await prisma.marketFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          images: { take: 1, orderBy: { order: "asc" } },
          _count: { select: { favorites: true, chats: true } },
          seller: { select: { id: true, nickname: true } },
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader title="관심목록" back sub={`총 ${favorites.length}개`} />

      {favorites.length === 0 ? (
        <EmptyState
          title="관심 상품이 없습니다"
          desc="마음에 드는 상품에 하트를 눌러 저장해보세요."
          action={<LinkButton href="/market">중고마켓 둘러보기</LinkButton>}
        />
      ) : (
        <div className="divide-y divide-navy-50">
          {favorites.map(({ listing: l }) => {
            const isSold = l.status === "SOLD";
            return (
              <Link
                key={l.id}
                href={`/market/${l.id}`}
                className={`flex items-start gap-3 bg-[#162538] px-3.5 py-3.5 transition-colors hover:bg-navy-50/50 ${isSold ? "opacity-50" : ""}`}
              >
                {/* 썸네일 */}
                <div className="relative h-[110px] w-[110px] shrink-0 overflow-hidden rounded-xl bg-navy-50">
                  {l.images[0] ? (
                    <img
                      src={l.images[0].url}
                      alt={l.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-navy-300">
                      <Heart size={28} strokeWidth={1.5} />
                    </div>
                  )}
                  {isSold && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-[12px] font-bold text-white">판매완료</span>
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[l.status] ?? "gray"}>
                      {marketStatusLabel(l.status)}
                    </Badge>
                    <span className="text-[11px] text-navy-300">
                      {marketCategoryLabel(l.category)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-navy-900">
                    {l.title}
                  </p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-navy-900">
                    {won(l.price)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-navy-300">
                    {l.region && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} />
                        {l.region}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5">
                      <Heart size={10} />
                      {l._count.favorites}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle size={10} />
                      {l._count.chats}
                    </span>
                    <span>· {timeAgo(l.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-navy-400">
                    {l.seller.nickname}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
