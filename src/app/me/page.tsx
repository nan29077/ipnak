import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, CalendarDays, Pencil, Tag, ChevronRight, Users, Fish, Navigation, Clock, Route, Coins } from "lucide-react";
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
import { ROLE_LABELS, reservationCategoryLabel } from "@/lib/taxonomy";
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
  const [shopEnabled, reservationEnabled, pEnabled, ballEnabled, ballPriceRaw] = await Promise.all([
    getBoolSetting("shop_menu_enabled"),
    getBoolSetting("reservation_enabled"),
    pointsEnabled(),
    getBoolSetting("ipnak_ball_enabled"),
    getSetting("ipnak_ball_price"),
  ]);
  const pointBalance = pEnabled ? await getBalance(user.id) : 0;

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 10,
  });

  // 총 데이터피싱 횟수
  const tripCount = await prisma.fishingTrip.count({ where: { userId: user.id, endedAt: { not: null } } });

  // 최근 데이터피싱 기록 (최대 3건)
  const recentTrips = await prisma.fishingTrip.findMany({
    where: { userId: user.id, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 3,
    select: { id: true, title: true, region: true, distanceM: true, durationSec: true, startedAt: true, catchCount: true },
  });

  const myWalkingPosts = await getWalkingFeedPosts(user.id, { authorId: user.id }, 6);

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
      <PageHeader title="마이" sub={ROLE_LABELS[user.role]} />

      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4 px-5 py-6">
        <Link href="/me/edit" className="relative shrink-0">
          <img src={getAvatarUrl(user.id, user.avatarUrl)} alt={user.nickname} className="h-[72px] w-[72px] rounded-full object-cover shadow-aqua" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white ring-2 ring-[#161616]">
            <Pencil size={11} />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[18px] font-bold text-navy-900">{user.nickname}</p>
            <Badge tone="navy">{ROLE_LABELS[user.role]}</Badge>
          </div>
          {data.user.region && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-navy-300">
              <MapPin size={13} />{data.user.region}
            </p>
          )}
          <div className="mt-2 flex gap-4">
            <HeaderStat n={stats.postCount} label="게시글" />
            <HeaderStat n={stats.followerCount} label="팔로워" />
            <HeaderStat n={stats.followingCount} label="팔로잉" accent />
          </div>
        </div>
        <Link href="/me/edit" className="flex items-center gap-1 rounded-full border border-navy-100 px-3 py-1.5 text-[12px] font-semibold text-navy-500 transition-colors hover:border-orange-400 hover:text-orange-400">
          수정
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-2.5 px-3.5">
        <Card className="p-3.5">
          <p className="mb-1 text-[11px] text-navy-300">최대 어획</p>
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
              ? `포획 ${stats.catchCount}마리 · 포인트 ${stats.pointCount}곳`
              : `피싱포인트 ${stats.pointCount}곳`}
          </p>
        </Card>
      </div>

      <div className="space-y-4 p-4">
        {data.user.bio && <p className="text-sm leading-relaxed text-navy-600">{data.user.bio}</p>}

        {user.role === "ANGLER" && ballEnabled && (
          <IpnakBallPurchase
            price={Number(ballPriceRaw)}
            buyer={{ name: user.nickname, email: user.email }}
            openOnMount={searchParams?.ipnakBallPurchase === "1"}
          />
        )}

        {/* 포인트 관리 — 포인트 기능 활성화 시 노출 */}
        {pEnabled && (
          <Link href="/me/points" className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-400/[0.12] to-[#161616] px-4 py-3.5 transition-colors hover:from-amber-400/20">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#161616] shadow-soft"><Coins size={19} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-navy-900">포인트 관리</span>
              <span className="block truncate text-[12px] text-navy-400">적립·사용 내역, 충전, 친구에게 선물</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[16px] font-extrabold tabular-nums text-amber-300">{pointBalance.toLocaleString()}<span className="text-[12px] text-amber-300/70">P</span></span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-amber-400/70" />
          </Link>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/trip"><Button variant="outline" full>낚시 기록 전체보기</Button></Link>
            <MeDiaryButton />
          </div>
          <div className="pt-2">
            <Link href={`/profile/${user.id}`}><Button variant="outline" full>내낚시방</Button></Link>
          </div>
        </div>

        {/* 데이터피싱 최근 기록 */}
        {recentTrips.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-navy-800">최근 데이터피싱 기록</p>
              <Link href="/trip" className="text-[11px] text-orange-400">전체보기 →</Link>
            </div>
            <div className="space-y-2">
              {recentTrips.map((t) => {
                const dist = t.distanceM >= 1000
                  ? `${(t.distanceM / 1000).toFixed(1)}km`
                  : `${Math.round(t.distanceM)}m`;
                const dur = t.durationSec >= 3600
                  ? `${Math.floor(t.durationSec / 3600)}h ${Math.floor((t.durationSec % 3600) / 60)}m`
                  : `${Math.floor(t.durationSec / 60)}분`;
                return (
                  <Link key={t.id} href={`/trip/${t.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3 transition-colors hover:border-orange-500/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aqua-500/15">
                      <Fish size={18} className="text-aqua-400" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-navy-800">
                        {t.title || (t.region ? `${t.region} 출조` : "데이터피싱")}
                      </p>
                      <div className="mt-0.5 flex gap-2.5 text-[11px] text-navy-400">
                        <span className="inline-flex items-center gap-0.5"><Navigation size={11} /> {dist}</span>
                        <span className="inline-flex items-center gap-0.5"><Clock size={11} /> {dur}</span>
                        {t.catchCount > 0 && (
                          <span className="inline-flex items-center gap-0.5"><Fish size={11} className="text-aqua-400" /> {t.catchCount}마리</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <TripMemoInline tripId={t.id} initialMemo={null} />
                      <span className="text-[10px] text-navy-400">
                        {new Date(t.startedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 쇼핑 메뉴 OFF 시 피싱태그 수익 숨김 */}
        {shopEnabled && (
          <Link href="/referral" className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 to-[#161616] px-4 py-3.5 transition-colors hover:from-orange-500/25">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-soft"><Tag size={19} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-navy-900">피싱태그 수익</span>
              <span className="block truncate text-[12px] text-navy-400">내 글의 피싱태그로 적립된 리퍼럴 수익 보기</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-orange-400" />
          </Link>
        )}

        {/* 내 입낚볼 관리 (NFC 연동 — 출시 전 준비 중) */}
        <MyBallManager />
      </div>

      {/* 내 낚시단 */}
      <section className="px-4 pb-4">
        <SectionTitle className="mb-2 flex items-center gap-1.5 text-[13px] text-navy-800"><Users size={16} /> 내 낚시단</SectionTitle>
        {myGroupMembers.length === 0 ? (
          <Card className="py-5 text-center">
            <p className="text-sm text-navy-300">소속된 낚시단이 없습니다</p>
            <Link href="/groups" className="mt-2 inline-block text-[12px] font-semibold text-orange-500">낚시단 둘러보기</Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {myGroupMembers.map((g: any) => (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <Card className="flex items-center gap-3 p-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-aqua-500/20">
                    <Fish size={16} className="text-orange-400" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-800">{g.name}</p>
                    <p className="text-xs text-navy-400">{g.category}{g.region ? ` · ${g.region}` : ""} · {Number(g.memberCount)}명</p>
                  </div>
                  {g.role === "leader" && (
                    <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">단장</span>
                  )}
                </Card>
              </Link>
            ))}
            <Link href="/groups" className="block text-center text-[12px] font-semibold text-orange-500 pt-1">
              낚시단 더보기
            </Link>
          </div>
        )}
      </section>

      {/* 내 예약 — 관리자가 예약 기능 비활성화 시 숨김 */}
      {reservationEnabled && (
        <section className="px-4 pb-4">
          <SectionTitle className="mb-2 flex items-center gap-1.5 text-[13px] text-navy-800"><CalendarDays size={16} /> 내 예약</SectionTitle>
          {bookings.length === 0 ? (
            <Card className="py-6 text-center text-sm text-navy-300">예약 내역이 없습니다</Card>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => {
                const st = BOOKING_STATUS[b.status];
                return (
                  <Card key={b.id} as="article" className="flex items-center gap-3 p-2.5" onClick={undefined}>
                    <Link href={`/reservations/${b.listingId}`} className="flex flex-1 items-center gap-3">
                      <img src={b.listing.imageUrl || ""} alt={b.listing.name} className="h-12 w-12 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy-800">{b.listing.name}</p>
                        <p className="mt-0.5 text-xs text-navy-400">{reservationCategoryLabel(b.listing.category)} · {kstFormat(b.date, "M월 d일")} · {b.people}명 · {won(b.totalPrice)}</p>
                      </div>
                      {st && <Badge tone={st.tone}>{st.label}</Badge>}
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 내 워킹 피드 — 데이터피싱 후 등록한 워킹 피드 */}
      {myWalkingPosts.length > 0 && (
        <section className="px-4 pb-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle className="flex items-center gap-1.5 text-[13px] text-navy-800"><Route size={16} /> 내 워킹 피드</SectionTitle>
            <Link href="/walking" className="text-[11px] text-orange-400">전체보기 →</Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {myWalkingPosts.map((p) => {
              let routePoints: { lat: number; lng: number }[] = [];
              let catchMarkers: { lat: number; lng: number }[] = [];
              try {
                const d = JSON.parse(p.body ?? "null");
                if (Array.isArray(d?.routePoints)) routePoints = d.routePoints;
                if (Array.isArray(d?.catchMarkers)) catchMarkers = d.catchMarkers;
              } catch {}
              return (
                <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#1b2b3a]">
                  {routePoints.length >= 2 ? (
                    <MiniRouteMap points={routePoints} catchPoints={catchMarkers.length > 0 ? catchMarkers : undefined} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Route size={28} className="text-aqua-300/50" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
