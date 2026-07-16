import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Heart, MessageCircle, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { marketCategoryLabel, marketStatusLabel } from "@/lib/taxonomy";
import { MyListingControls } from "@/components/market/MyListingControls";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

export default async function MyMarketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const listings = await prisma.marketListing.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { favorites: true, chats: true } },
    },
  });

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader title="내 판매글" back sub={`총 ${listings.length}개`} right={
        <Link href="/market/new" aria-label="판매글 등록" className="rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50">
          <Plus size={22} />
        </Link>
      } />

      {listings.length === 0 ? (
        <EmptyState
          title="등록한 판매글이 없습니다"
          desc="사용하지 않는 낚시 용품을 등록해보세요."
          action={<LinkButton href="/market/new">판매글 등록하기</LinkButton>}
        />
      ) : (
        <div className="space-y-2.5 p-3.5">
          {listings.map((l) => (
            <div key={l.id} className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-2.5 shadow-card">
              <div className="flex gap-3">
                <Link href={`/market/${l.id}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                  {l.images[0] && <img src={l.images[0].url} alt={l.title} className="h-full w-full object-cover" />}
                </Link>
                <Link href={`/market/${l.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[l.status]}>{marketStatusLabel(l.status)}</Badge>
                    <span className="text-[11px] text-navy-300">{marketCategoryLabel(l.category)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[14px] font-semibold text-navy-900">{l.title}</p>
                  <p className="text-[15px] font-extrabold text-navy-900">{won(l.price)}</p>
                  <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-navy-300">
                    <span className="inline-flex items-center gap-0.5"><Heart size={11} />{l._count.favorites}</span>
                    <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} />{l._count.chats}</span>
                    <span className="inline-flex items-center gap-0.5"><Eye size={11} />{l.viewCount}</span>
                    <span>· {timeAgo(l.createdAt)}</span>
                  </div>
                </Link>
              </div>
              <div className="mt-2.5 flex justify-end border-t border-navy-50 pt-2.5">
                <MyListingControls listingId={l.id} initialStatus={l.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
