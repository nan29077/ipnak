import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Heart, MessageCircle, Eye, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Badge, SectionTitle } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketCategoryLabel, marketConditionLabel, marketStatusLabel } from "@/lib/taxonomy";
import { MarketDetailActions } from "@/components/market/MarketDetailActions";
import { MarketOwnerActions } from "@/components/market/MarketOwnerActions";
import { MarketGallery } from "@/components/market/MarketGallery";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

export default async function MarketDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const l = await prisma.marketListing.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: { order: "asc" } },
      seller: { select: { id: true, nickname: true, avatarUrl: true, region: true } },
      _count: { select: { favorites: true, chats: true } },
    },
  });
  if (!l) notFound();

  // 조회수 증가 (best-effort)
  await prisma.marketListing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const isOwner = !!user && user.id === l.sellerId;
  const favorited = !!user && !isOwner
    ? !!(await prisma.marketFavorite.findUnique({ where: { listingId_userId: { listingId: l.id, userId: user.id } } }))
    : false;

  const images = l.images.length ? l.images.map((i) => i.url) : ["https://picsum.photos/seed/market/800/800"];

  return (
    <div className="min-h-screen bg-[#1e1e1e] pb-28">
      <PageHeader title="중고거래" back />

      <MarketGallery images={images} dim={l.status === "SOLD"} statusLabel={l.status !== "SELLING" ? marketStatusLabel(l.status) : null} />

      <div className="space-y-4 p-4">
        {/* 판매자 */}
        <Link href={`/profile/${l.seller.id}`} className="flex items-center gap-3 border-b border-navy-100 pb-3">
          <img src={getAvatarUrl(l.seller.id, l.seller.avatarUrl)} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-navy-100" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-navy-900">{l.seller.nickname}</p>
            {(l.seller.region || l.region) && (
              <p className="inline-flex items-center gap-1 text-[12px] text-navy-300"><MapPin size={11} />{l.region || l.seller.region}</p>
            )}
          </div>
          <ChevronRight size={18} className="text-navy-300" />
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[l.status]}>{marketStatusLabel(l.status)}</Badge>
            <Badge tone="navy">{marketCategoryLabel(l.category)}</Badge>
            <Badge tone={l.condition === "NEW" ? "aqua" : "gray"}>{marketConditionLabel(l.condition)}</Badge>
          </div>
          <h1 className="mt-2 text-[19px] font-bold leading-snug text-navy-900">{l.title}</h1>
          <p className="mt-1 text-[13px] text-navy-300">{timeAgo(l.createdAt)}</p>
          <p className="mt-2 text-[24px] font-extrabold text-navy-900">{won(l.price)}</p>
        </div>

        {l.description && (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-navy-700">{l.description}</p>
        )}

        <div className="flex items-center gap-4 border-t border-navy-100 pt-3 text-[12px] text-navy-300">
          <span className="inline-flex items-center gap-1"><Heart size={13} /> 찜 {l._count.favorites}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> 채팅 {l._count.chats}</span>
          <span className="inline-flex items-center gap-1"><Eye size={13} /> 조회 {l.viewCount}</span>
        </div>

        {!user && (
          <div className="rounded-2xl bg-navy-50 p-4 text-center text-[13px] text-navy-500">
            <Link href="/login" className="font-semibold text-aqua-600 underline">로그인</Link> 후 찜하기와 채팅을 이용할 수 있어요.
          </div>
        )}
      </div>

      {isOwner ? (
        <MarketOwnerActions listingId={l.id} initialStatus={l.status} />
      ) : user ? (
        <MarketDetailActions listingId={l.id} price={l.price} status={l.status} favorited={favorited} favoriteCount={l._count.favorites} />
      ) : (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#161616]/95 p-3 backdrop-blur-md md:relative">
          <div className="mx-auto max-w-[640px]">
            <Link href="/login" className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-[15px] font-semibold text-white shadow-soft">
              로그인하고 거래하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
