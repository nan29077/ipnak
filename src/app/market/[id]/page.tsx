import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight, Shield, Clock, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PostDetailClient } from "@/app/post/[id]/PostDetailClient";
import { PageHeader, Badge, SectionTitle } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketCategoryLabel, marketConditionLabel, marketStatusLabel } from "@/lib/taxonomy";
import { MarketDetailActions } from "@/components/market/MarketDetailActions";
import { MarketOwnerActions } from "@/components/market/MarketOwnerActions";
import { MarketGallery } from "@/components/market/MarketGallery";
import { MarketStats } from "@/components/market/MarketStats";
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

  // 조회수 증가 (best-effort) — 업데이트된 값으로 viewCount 갱신
  const updated = await prisma.marketListing.update({
    where: { id: l.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  }).catch(() => null);
  const viewCount = updated?.viewCount ?? l.viewCount + 1;

  const isOwner = !!user && user.id === l.sellerId;
  const favorited = !!user && !isOwner
    ? !!(await prisma.marketFavorite.findUnique({ where: { listingId_userId: { listingId: l.id, userId: user.id } } }))
    : false;

  const images = l.images.length ? l.images.map((i) => i.url) : ["https://picsum.photos/seed/market/800/800"];

  // 판매자의 다른 판매글 (최신 4개, 현재 상품 제외)
  const otherListings = await prisma.marketListing.findMany({
    where: { sellerId: l.sellerId, id: { not: l.id }, status: { not: "SOLD" } },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: { images: { take: 1, orderBy: { order: "asc" } } },
  });

  // 판매자 완료 거래 수
  const sellerSoldCount = await prisma.marketListing.count({
    where: { sellerId: l.sellerId, status: "SOLD" },
  });

  // 이 상품의 구매 희망자 채팅 목록 (판매자 전용)
  const buyerChats = isOwner
    ? await prisma.marketChat.findMany({
        where: { listingId: l.id },
        include: {
          buyer: { select: { id: true, nickname: true, avatarUrl: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <PostDetailClient>
    <div className="min-h-screen bg-[#0d1b2a] pb-20">
      <PageHeader title="중고마켓" back />

      <MarketGallery images={images} dim={l.status === "SOLD"} statusLabel={l.status !== "SELLING" ? marketStatusLabel(l.status) : null} />

      <div className="bg-[#0d1b2a]">
        {/* 판매자 정보 */}
        <Link href={`/profile/${l.seller.id}`} className="flex items-center gap-3 border-b border-navy-100/20 px-4 py-3.5 transition-colors active:bg-navy-50/5">
          <img src={getAvatarUrl(l.seller.id, l.seller.avatarUrl)} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-navy-100/20" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-navy-900">{l.seller.nickname}</p>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-navy-400">
              {(l.seller.region || l.region) && (
                <span className="inline-flex items-center gap-0.5"><MapPin size={11} />{l.region || l.seller.region}</span>
              )}
              {sellerSoldCount > 0 && (
                <span className="inline-flex items-center gap-0.5"><Package size={11} /> 거래 {sellerSoldCount}회</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1">
              <Shield size={11} className="text-orange-400" />
              <span className="text-[11px] font-semibold text-orange-400">신뢰 판매자</span>
            </div>
            <ChevronRight size={16} className="text-navy-300" />
          </div>
        </Link>

        {/* 상품 정보 */}
        <div className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[l.status]}>{marketStatusLabel(l.status)}</Badge>
            <Badge tone="navy">{marketCategoryLabel(l.category)}</Badge>
            <Badge tone={l.condition === "NEW" ? "aqua" : "gray"}>{marketConditionLabel(l.condition)}</Badge>
          </div>
          <h1 className="text-[20px] font-bold leading-snug text-navy-900">{l.title}</h1>
          <div className="flex items-end justify-between">
            <p className="text-[26px] font-extrabold text-navy-900">{won(l.price)}</p>
            <p className="flex items-center gap-1 text-[12px] text-navy-400">
              <Clock size={12} /> {timeAgo(l.createdAt)}
            </p>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-2 bg-[#0a1220]" />

        {/* 상품 설명 */}
        <div className="px-4 py-4">
          <h2 className="mb-2 text-[14px] font-bold text-navy-700">상품 설명</h2>
          {l.description ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-navy-700">{l.description}</p>
          ) : (
            <p className="text-[14px] text-navy-400">등록된 설명이 없습니다.</p>
          )}
        </div>

        {/* 거래 정보 */}
        <div className="mx-4 mb-4 rounded-2xl bg-navy-50/10 p-3.5">
          <h2 className="mb-2.5 text-[13px] font-bold text-navy-600">거래 정보</h2>
          <div className="grid grid-cols-2 gap-2.5 text-[13px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-navy-400">거래 지역</span>
              <span className="font-semibold text-navy-700">{l.region || "전국"}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-navy-400">배송 방법</span>
              <span className="font-semibold text-navy-700">직거래 · 택배</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-navy-400">카테고리</span>
              <span className="font-semibold text-navy-700">{marketCategoryLabel(l.category)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-navy-400">상품 상태</span>
              <span className="font-semibold text-navy-700">{marketConditionLabel(l.condition)}</span>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-2 bg-[#0a1220]" />

        {/* 통계 — 관심 토글 시 실시간 반영, 마운트 후 최신값 fetch */}
        <MarketStats
          listingId={l.id}
          initialFavoriteCount={l._count.favorites}
          initialChatCount={l._count.chats}
          initialViewCount={viewCount}
        />

        {!user && (
          <div className="mx-4 my-4 rounded-2xl bg-navy-50/10 p-4 text-center text-[13px] text-navy-500">
            <Link href="/login" className="font-semibold text-orange-400 underline">로그인</Link>하면 찜하기와 채팅을 이용할 수 있어요.
          </div>
        )}

        {/* 판매자 전용: 구매 희망자 채팅 목록 */}
        {isOwner && buyerChats.length > 0 && (
          <>
            <div className="h-2 bg-[#0a1220]" />
            <div className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-navy-800">구매 희망자 채팅</h2>
                <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-orange-400">
                  {buyerChats.length}명
                </span>
              </div>
              <div className="space-y-2.5">
                {buyerChats.map((c) => {
                  const lastMsg = c.messages[0];
                  const isSystem = lastMsg?.body.startsWith("[시스템]");
                  const needsReply = lastMsg && !isSystem && lastMsg.senderId !== user!.id;
                  return (
                    <Link
                      key={c.id}
                      href={`/market/chats/${c.id}`}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors active:opacity-80 ${
                        needsReply
                          ? "border-amber-400/40 bg-amber-400/10"
                          : "border-navy-100/20 bg-navy-50/10"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={getAvatarUrl(c.buyer.id, c.buyer.avatarUrl)}
                          alt={c.buyer.nickname}
                          className="h-11 w-11 rounded-full object-cover ring-1 ring-navy-100/20"
                        />
                        {needsReply && (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-[#0d1b2a]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-navy-900">{c.buyer.nickname}</p>
                        <p className={`mt-0.5 truncate text-[12px] ${needsReply ? "font-semibold text-amber-300" : "text-navy-400"}`}>
                          {lastMsg
                            ? isSystem
                              ? lastMsg.body.replace("[시스템] ", "")
                              : lastMsg.body
                            : "대화를 시작해보세요"}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-semibold" style={{ background: needsReply ? "#eab308" : "#1e3a5f", color: needsReply ? "#000" : "#94a3b8" }}>
                        {needsReply ? "답장하기" : "채팅보기"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 판매자의 다른 상품 */}
        {otherListings.length > 0 && (
          <>
            <div className="h-2 bg-[#0a1220]" />
            <div className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-navy-800">{l.seller.nickname}님의 다른 판매글</h2>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {otherListings.map((ol) => (
                  <Link key={ol.id} href={`/market/${ol.id}`} className="flex flex-col gap-1">
                    <div className="aspect-square overflow-hidden rounded-xl bg-navy-100/20">
                      {ol.images[0] ? (
                        <img src={ol.images[0].url} alt={ol.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-navy-300"><Package size={16} /></div>
                      )}
                    </div>
                    <p className="line-clamp-1 text-[11px] font-medium text-navy-700">{ol.title}</p>
                    <p className="text-[12px] font-bold text-navy-900">{won(ol.price)}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {isOwner ? (
        <MarketOwnerActions listingId={l.id} initialStatus={l.status} />
      ) : user ? (
        <MarketDetailActions listingId={l.id} price={l.price} status={l.status} favorited={favorited} favoriteCount={l._count.favorites} />
      ) : (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-navy-100/20 bg-[#0d1b2a]/95 p-3 backdrop-blur-md md:relative">
          <div className="mx-auto max-w-[640px]">
            <Link href="/login" className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-[15px] font-semibold text-white shadow-soft">
              로그인하고 거래하기
            </Link>
          </div>
        </div>
      )}
    </div>
    </PostDetailClient>
  );
}
