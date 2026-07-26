import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getProfileData } from "@/lib/profile";
import { getWalkingFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { getBalance, pointsEnabled } from "@/lib/points";
import { MePageTabs } from "@/components/MePageTabs";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams?: { ipnakBallPurchase?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getProfileData(user.id, user.id);
  if (!data) redirect("/login");
  const { stats } = data;
  const [shopEnabled, reservationEnabled, pEnabled, ballEnabled, ballPriceRaw, bassOnly, shopTagEnabled] = await Promise.all([
    getBoolSetting("shop_menu_enabled"),
    getBoolSetting("reservation_enabled"),
    pointsEnabled(),
    getBoolSetting("ipnak_ball_enabled"),
    getSetting("ipnak_ball_price"),
    getBoolSetting("bass_only_mode"),
    getBoolSetting("shop_tag_enabled"),
  ]);
  const anglerLabel = user.role === "ANGLER" && bassOnly ? "앵글러" : ROLE_LABELS[user.role];
  const pointBalance = pEnabled ? await getBalance(user.id) : 0;

  const bookingsRaw = await prisma.booking.findMany({
    where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 10,
  });

  const tripCount = await prisma.fishingTrip.count({ where: { userId: user.id, endedAt: { not: null } } });

  const recentTripsRaw = await prisma.fishingTrip.findMany({
    where: { userId: user.id, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 3,
    select: { id: true, title: true, region: true, distanceM: true, durationSec: true, startedAt: true, catchCount: true },
  });

  const myWalkingPosts = await getWalkingFeedPosts(user.id, { authorId: user.id }, 6);

  const [marketSellCount, marketBuyCount, marketFavCount, marketChatCount] = await Promise.all([
    prisma.marketListing.count({ where: { sellerId: user.id } }),
    prisma.marketChat.count({ where: { buyerId: user.id } }),
    prisma.marketFavorite.count({ where: { userId: user.id } }),
    prisma.marketChat.count({ where: { OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }] } }),
  ]);

  const sellerChatsRaw = await prisma.marketChat.findMany({
    where: { listing: { sellerId: user.id } },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      buyer: { select: { id: true, nickname: true, avatarUrl: true } },
      listing: { select: { id: true, title: true, images: { take: 1, orderBy: { order: "asc" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const needsReplyChatsRaw = sellerChatsRaw.filter(
    (c) => c.messages.length > 0 && c.messages[0].senderId !== user.id && !c.messages[0].body.startsWith("[시스템]")
  );

  const myGroupMembers = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.role, g.id, g.name, g.category, g.region, g.fishSpecies,
            COUNT(gm.id) as memberCount
     FROM "GroupMember" m
     LEFT JOIN "Group" g ON g.id = m.groupId
     LEFT JOIN "GroupMember" gm ON gm.groupId = g.id AND gm.role IN ('leader','member')
     WHERE m.userId = ? AND m.role IN ('leader','member')
     GROUP BY g.id
     ORDER BY m.joinedAt DESC
     LIMIT 5`,
    user.id
  );

  // 직렬화: Date → ISO string
  const recentTrips = recentTripsRaw.map((t) => ({ ...t, startedAt: t.startedAt.toISOString() }));
  const bookings = bookingsRaw.map((b) => ({
    id: b.id,
    listingId: b.listingId,
    status: b.status,
    date: b.date.toISOString(),
    people: b.people,
    totalPrice: b.totalPrice,
    listing: { imageUrl: b.listing.imageUrl, name: b.listing.name, category: b.listing.category },
  }));
  const needsReplyChats = needsReplyChatsRaw.map((c) => ({
    id: c.id,
    buyer: { id: c.buyer.id, nickname: c.buyer.nickname, avatarUrl: c.buyer.avatarUrl },
    listing: { id: c.listing.id, title: c.listing.title },
    messages: c.messages.map((m) => ({ body: m.body })),
  }));

  return (
    <div className="pb-10">
      <PageHeader title="마이" sub={anglerLabel} />

      {/* ── 프로필 헤더 (항상 표시) ── */}
      <div className="flex items-center gap-4 px-5 py-6">
        <Link href="/me/edit" className="relative shrink-0">
          <img src={getAvatarUrl(user.id, user.avatarUrl)} alt={user.nickname} className="h-[72px] w-[72px] rounded-full object-cover shadow-aqua" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white ring-2 ring-[#0d1b2a]">
            <Pencil size={11} />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[18px] font-bold text-navy-900">{user.nickname}</p>
            <Badge tone="navy">{anglerLabel}</Badge>
          </div>
          {data.user.region && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-navy-300">
              <MapPin size={13} />{data.user.region}
            </p>
          )}
          <div className="mt-2 flex gap-4">
            <HeaderStat n={stats.postCount} label="게시글" />
            <Link href={`/profile/${user.id}/followers`}><HeaderStat n={stats.followerCount} label="팔로워" /></Link>
            <Link href={`/profile/${user.id}/following`}><HeaderStat n={stats.followingCount} label="팔로잉" accent /></Link>
          </div>
        </div>
        <Link href="/me/edit" className="flex items-center gap-1 rounded-full border border-navy-100 px-3 py-1.5 text-[12px] font-semibold text-navy-500 transition-colors hover:border-orange-400 hover:text-orange-400">
          수정
        </Link>
      </div>

      {/* ── 통계 카드 (항상 표시) ── */}
      <div className="grid grid-cols-2 gap-2.5 px-3.5">
        <Card className="p-3.5">
          <p className="mb-1 text-[11px] text-navy-300">최대 기록</p>
          <p className="text-[22px] font-extrabold text-aqua-500">
            {stats.maxSize ?? "-"}<span className="ml-0.5 text-[13px] font-semibold text-navy-300">cm</span>
          </p>
          <p className="text-[11px] text-navy-300">{stats.topSpecies ?? "기록 없음"}</p>
        </Card>
        <Card className="p-3.5">
          <p className="mb-1 text-[11px] text-navy-300">총 낚시 횟수</p>
          <p className="text-[22px] font-extrabold text-navy-700">
            {tripCount}<span className="ml-0.5 text-[13px] font-semibold text-navy-300">회</span>
          </p>
          <p className="text-[11px] text-navy-300">
            {stats.catchCount > 0
              ? `피싱 ${stats.catchCount}마리 · 포인트 ${stats.pointCount}곳`
              : `피싱포인트 ${stats.pointCount}곳`}
          </p>
        </Card>
      </div>

      {/* ── 탭 (클라이언트 컴포넌트) ── */}
      <MePageTabs
        user={{ id: user.id, nickname: user.nickname, email: user.email, role: user.role, avatarUrl: user.avatarUrl }}
        isAdmin={user.role === "SUPER_ADMIN"}
        shopEnabled={shopEnabled}
        shopTagEnabled={shopTagEnabled}
        reservationEnabled={reservationEnabled}
        pEnabled={pEnabled}
        ballEnabled={ballEnabled}
        ballPriceRaw={Number(ballPriceRaw)}
        openBallOnMount={searchParams?.ipnakBallPurchase === "1"}
        pointBalance={pointBalance}
        recentTrips={recentTrips}
        myWalkingPosts={myWalkingPosts.map((p) => ({ id: p.id, body: p.body ?? null }))}
        marketSellCount={marketSellCount}
        marketBuyCount={marketBuyCount}
        marketFavCount={marketFavCount}
        marketChatCount={marketChatCount}
        needsReplyChats={needsReplyChats}
        myGroupMembers={myGroupMembers}
        bookings={bookings}
        posts={data.posts}
        points={data.points}
        entries={data.entries}
        bio={data.user.bio ?? null}
      />
    </div>
  );
}

function HeaderStat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={accent ? "text-[16px] font-bold text-aqua-500" : "text-[16px] font-bold text-navy-900"}>{n}</p>
      <p className="text-[10px] text-navy-300">{label}</p>
    </div>
  );
}
