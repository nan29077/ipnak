import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, CalendarDays, Pencil, Tag, ChevronRight, Fish, Navigation, Clock, Route, Coins, ShoppingBag, Heart, MessageCircle, Plus, Users, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getProfileData } from "@/lib/profile";
import { getWalkingFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { getBalance, pointsEnabled } from "@/lib/points";
import { ProfileView } from "@/components/ProfileView";
import { MeActions } from "@/components/MeActions";
import { MeDiaryButton } from "@/components/MeDiaryButton";
import { MyBallManager } from "@/components/BallLinkSection";
import TripMemoInline from "@/components/TripMemoInline";
import { PageHeader, Card, Badge, Button, SectionTitle } from "@/components/ui";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { ROLE_LABELS, getAnglerLabel, reservationCategoryLabel } from "@/lib/taxonomy";
import { won, kstFormat } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { IpnakBallPurchase } from "@/components/IpnakBallPurchase";

export const dynamic = "force-dynamic";

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  REQUESTED: { label: "예약요청", tone: "amber" },
  CONFIRMED: { label: "확정", tone: "aqua" },
  CANCELLED: { label: "취소", tone: "red" },
  DONE: { label: "이용완료", tone: "gray" },
};

export default async function MePage({ searchParams }: { searchParams?: { ipnakBallPurchase?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getProfileData(user.id, user.id);
  if (!data) redirect("/login");
  const { stats } = data;
  const [shopEnabled, reservationEnabled, pEnabled, ballEnabled, ballPriceRaw, bassOnly] = await Promise.all([
    getBoolSetting("shop_menu_enabled"),
    getBoolSetting("reservation_enabled"),
    pointsEnabled(),
    getBoolSetting("ipnak_ball_enabled"),
    getSetting("ipnak_ball_price"),
    getBoolSetting("bass_only_mode"),
  ]);
  const anglerLabel = user.role === "ANGLER" && bassOnly ? "앵글러" : ROLE_LABELS[user.role];
  const pointBalance = pEnabled ? await getBalance(user.id) : 0;

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 10,
  });

  // 총 스마트피싱 횟수
  const tripCount = await prisma.fishingTrip.count({ where: { userId: user.id, endedAt: { not: null } } });

  // 최근 스마트피싱 기록 (최대 3건)
  const recentTrips = await prisma.fishingTrip.findMany({
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

  // 판매자로서 답장이 필요한 채팅 (마지막 메시지가 구매자가 보낸 것)
  const sellerChatsRaw = await prisma.marketChat.findMany({
    where: { listing: { sellerId: user.id } },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      buyer: { select: { id: true, nickname: true, avatarUrl: true } },
      listing: { select: { id: true, title: true, images: { take: 1, orderBy: { order: "asc" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const needsReplyChats = sellerChatsRaw.filter(
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

  return (
    <div className="pb-10">
      <PageHeader title="마이" sub={anglerLabel} />

      {/* 프로필 헤더 */}
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

      {/* 통계 카드 */}
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

      {/* ─── 기능별 카드 섹션 ─── */}
      <div className="space-y-3 px-3.5 pb-8 pt-3">
        {data.user.bio && <p className="px-1 text-sm leading-relaxed text-navy-500">{data.user.bio}</p>}

        {/* ── 낚시 활동 ── */}
        <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
          <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
            <Fish size={14} className="text-aqua-400" strokeWidth={1.8} />
            <p className="text-[13px] font-bold text-navy-700">낚시 활동</p>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/trip"><Button variant="outline" full>낚시 기록 전체보기</Button></Link>
              <MeDiaryButton />
            </div>
            <div className="mt-2">
              <Link href={`/profile/${user.id}`}><Button variant="outline" full>내낚시방</Button></Link>
            </div>

            {/* 최근 스마트피싱 */}
            {recentTrips.length > 0 && (
              <div className="mt-3 border-t border-navy-100/15 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-bold text-navy-500">최근 스마트피싱</p>
                  <Link href="/trip" className="text-[11px] text-orange-400">전체보기 →</Link>
                </div>
                <div className="space-y-2">
                  {recentTrips.map((t) => {
                    const dist = t.distanceM >= 1000 ? `${(t.distanceM / 1000).toFixed(1)}km` : `${Math.round(t.distanceM)}m`;
                    const dur = t.durationSec >= 3600 ? `${Math.floor(t.durationSec / 3600)}h ${Math.floor((t.durationSec % 3600) / 60)}m` : `${Math.floor(t.durationSec / 60)}분`;
                    return (
                      <Link key={t.id} href={`/trip/${t.id}`} className="flex items-center gap-3 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-500/15">
                          <Fish size={16} className="text-aqua-400" strokeWidth={1.6} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-navy-800">{(t.title || (t.region ? `${t.region} 출조` : "스마트피싱")).replace(/데이터피싱/g, "스마트피싱")}</p>
                          <div className="mt-0.5 flex gap-2 text-[11px] text-navy-400">
                            <span className="inline-flex items-center gap-0.5"><Navigation size={10} /> {dist}</span>
                            <span className="inline-flex items-center gap-0.5"><Clock size={10} /> {dur}</span>
                            {t.catchCount > 0 && <span className="inline-flex items-center gap-0.5"><Fish size={10} className="text-aqua-400" /> {t.catchCount}마리</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <TripMemoInline tripId={t.id} initialMemo={null} />
                          <span className="text-[10px] text-navy-400">{new Date(t.startedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 워킹 피드 */}
            {myWalkingPosts.length > 0 && (
              <div className="mt-3 border-t border-navy-100/15 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-bold text-navy-500">내 워킹 피드</p>
                  <Link href="/walking" className="text-[11px] text-orange-400">전체보기 →</Link>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {myWalkingPosts.map((p) => {
                    let routePoints: { lat: number; lng: number }[] = [];
                    let catchMarkers: { lat: number; lng: number }[] = [];
                    try { const d = JSON.parse(p.body ?? "null"); if (Array.isArray(d?.routePoints)) routePoints = d.routePoints; if (Array.isArray(d?.catchMarkers)) catchMarkers = d.catchMarkers; } catch {}
                    return (
                      <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#1b2b3a]">
                        {routePoints.length >= 2 ? <MiniRouteMap points={routePoints} catchPoints={catchMarkers.length > 0 ? catchMarkers : undefined} /> : <div className="flex h-full w-full items-center justify-center"><Route size={24} className="text-aqua-300/50" /></div>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 중고피싱 ── */}
        <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
          <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
            <ShoppingBag size={14} className="text-orange-400" />
            <p className="text-[13px] font-bold text-navy-700">중고피싱</p>
            <Link href="/market" className="ml-auto text-[11px] text-orange-400">마켓 바로가기 →</Link>
          </div>
          <div className="p-3">
            {needsReplyChats.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">{needsReplyChats.length}</span>
                  <p className="text-[13px] font-bold text-amber-400">답장이 필요한 채팅</p>
                </div>
                <div className="space-y-2">
                  {needsReplyChats.slice(0, 3).map((c) => (
                    <Link key={c.id} href={`/market/chats/${c.id}`} className="flex items-center gap-2.5 rounded-lg bg-[#0d1b2a]/50 px-2.5 py-2">
                      <img src={getAvatarUrl(c.buyer.id, c.buyer.avatarUrl)} alt={c.buyer.nickname} className="h-8 w-8 rounded-full object-cover ring-1 ring-navy-100/20" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-navy-800">{c.buyer.nickname}</p>
                        <p className="truncate text-[11px] text-navy-400">{c.listing.title}</p>
                        <p className="truncate text-[11px] text-amber-300">{c.messages[0]?.body}</p>
                      </div>
                      <ChevronRight size={14} className="shrink-0 text-navy-400" />
                    </Link>
                  ))}
                  {needsReplyChats.length > 3 && (
                    <Link href="/market/chats" className="block pt-1 text-center text-[11px] text-amber-400">+{needsReplyChats.length - 3}개 더 보기</Link>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/market/mine" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15"><Tag size={15} className="text-orange-400" /></div>
                <div><p className="text-[12px] font-semibold text-navy-800">판매내역</p><p className="text-[10px] text-navy-400">{marketSellCount}개</p></div>
              </Link>
              <Link href="/market/purchases" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-400/15"><ShoppingBag size={15} className="text-aqua-400" /></div>
                <div><p className="text-[12px] font-semibold text-navy-800">구매내역</p><p className="text-[10px] text-navy-400">{marketBuyCount}개</p></div>
              </Link>
              <Link href="/market/favorites" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15"><Heart size={15} className="text-red-400" /></div>
                <div><p className="text-[12px] font-semibold text-navy-800">관심목록</p><p className="text-[10px] text-navy-400">{marketFavCount}개</p></div>
              </Link>
              <Link href="/market/chats" className="relative flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                {needsReplyChats.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{needsReplyChats.length}</span>
                )}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-300/15">
                  <MessageCircle size={15} className={needsReplyChats.length > 0 ? "text-red-400" : "text-navy-400"} />
                </div>
                <div><p className="text-[12px] font-semibold text-navy-800">채팅</p><p className="text-[10px] text-navy-400">{marketChatCount}개</p></div>
              </Link>
            </div>
            <Link href="/market/new" className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> 판매하기
            </Link>
          </div>
        </div>

        {/* ── 입낚볼 ── */}
        {user.role === "ANGLER" && ballEnabled && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 px-1">
              <Radio size={13} className="text-orange-400" />
              <p className="text-[12px] font-bold text-navy-500">입낚볼</p>
            </div>
            <div className="space-y-2">
              <IpnakBallPurchase
                price={Number(ballPriceRaw)}
                buyer={{ name: user.nickname, email: user.email }}
                openOnMount={searchParams?.ipnakBallPurchase === "1"}
              />
              <MyBallManager />
            </div>
          </div>
        )}

        {/* ── 포인트 & 혜택 ── */}
        {(pEnabled || shopEnabled) && (
          <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[#162538]">
            <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
              <Coins size={14} className="text-amber-400" />
              <p className="text-[13px] font-bold text-navy-700">포인트 & 혜택</p>
            </div>
            <div className="divide-y divide-navy-100/15 px-4">
              {pEnabled && (
                <Link href="/me/points" className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#0d1b2a]"><Coins size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-navy-900">포인트 관리</span>
                    <span className="block text-[11px] text-navy-400">적립·사용 내역, 충전, 친구에게 선물</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-amber-400">{pointBalance.toLocaleString()}<span className="text-[11px] text-amber-400/70">P</span></span>
                  <ChevronRight size={16} className="shrink-0 text-navy-300" />
                </Link>
              )}
              {shopEnabled && (
                <Link href="/referral" className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"><Tag size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-navy-900">피싱태그 수익</span>
                    <span className="block text-[11px] text-navy-400">내 글의 피싱태그로 적립된 리퍼럴 수익</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-navy-300" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── 내 낚시단 ── */}
        <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
          <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
            <Users size={14} className="text-navy-400" />
            <p className="text-[13px] font-bold text-navy-700">내 낚시단</p>
            <Link href="/groups" className="ml-auto text-[11px] text-orange-400">전체보기 →</Link>
          </div>
          <div className="p-3">
            {myGroupMembers.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-[13px] text-navy-400">소속된 낚시단이 없습니다</p>
                <Link href="/groups" className="mt-1 inline-block text-[12px] font-semibold text-orange-500">낚시단 찾기</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myGroupMembers.map((g: any) => (
                  <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-aqua-500/20">
                      <Fish size={15} className="text-orange-400" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-navy-800">{g.name}</p>
                      <p className="text-[11px] text-navy-400">{g.category}{g.region ? ` · ${g.region}` : ""} · {Number(g.memberCount)}명</p>
                    </div>
                    {g.role === "leader" && <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">단장</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 내 예약 ── */}
        {reservationEnabled && (
          <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
            <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
              <CalendarDays size={14} className="text-navy-400" />
              <p className="text-[13px] font-bold text-navy-700">내 예약</p>
            </div>
            <div className="p-3">
              {bookings.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-navy-400">예약 내역이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b) => {
                    const st = BOOKING_STATUS[b.status];
                    return (
                      <Link key={b.id} href={`/reservations/${b.listingId}`} className="flex items-center gap-3 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5">
                        <img src={b.listing.imageUrl || ""} alt={b.listing.name} className="h-11 w-11 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-navy-800">{b.listing.name}</p>
                          <p className="mt-0.5 text-[11px] text-navy-400">{reservationCategoryLabel(b.listing.category)} · {kstFormat(b.date, "M월 d일")} · {b.people}명 · {won(b.totalPrice)}</p>
                        </div>
                        {st && <Badge tone={st.tone}>{st.label}</Badge>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-navy-100 pt-2">
        <ProfileView posts={data.posts} points={data.points} entries={data.entries} />
      </div>

      <div className="mt-4 border-t border-navy-100 pt-3">
        <MeActions isAdmin={user.role === "SUPER_ADMIN"} />
      </div>
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
