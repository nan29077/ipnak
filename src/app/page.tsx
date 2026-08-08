import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts, getWalkingFeedPosts, getPersonalizedFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { CurationHome } from "@/components/CurationHome";
import { getMainSections } from "@/lib/curation";
import { parseInterests } from "@/lib/interestsUtils";
import { MobileLandingRedirect } from "@/components/MobileLandingRedirect";
import { PcLandingRedirect } from "@/components/PcLandingRedirect";
import { syncTournamentStatuses } from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  await syncTournamentStatuses();

  // 로그인 유저: DB에서 관심사 파싱
  let userInterests = { methods: [] as string[], species: [] as string[] };
  let userNickname: string | undefined;

  if (user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { interests: true, nickname: true },
    });
    userInterests = parseInterests(dbUser?.interests ?? null);
    userNickname = dbUser?.nickname ?? undefined;
  }

  const hasInterests = userInterests.methods.length > 0 || userInterests.species.length > 0;

  const [feedPosts, walkingPosts, sections, topBannerRows, bottomBannerRows, ongoingTournaments, personalizedPosts] = await Promise.all([
    getFeedPosts(user?.id, { kind: "FEED" }),
    getWalkingFeedPosts(user?.id),
    getMainSections(10),
    // 배너는 section 기반으로 노출 위치를 구분한다.
    // 홈 상단: main_top / 홈 하단: main_bottom — notice·event 섹션 배너는 홈에 노출하지 않는다.
    prisma.banner.findMany({ where: { active: true, section: "main_top" }, orderBy: { order: "asc" } }),
    prisma.banner.findMany({ where: { active: true, section: "main_bottom" }, orderBy: { order: "asc" } }),
    prisma.tournament.findMany({
      where: { status: "ONGOING" },
      orderBy: { startAt: "asc" },
      include: { _count: { select: { entries: true } } },
    }).catch(() => []),
    // 맞춤 피드: 관심사 있을 때만 쿼리
    user && hasInterests
      ? getPersonalizedFeedPosts(user.id, userInterests)
      : Promise.resolve([]),
  ]);

  // "입점" 관련 배너는 제외 — 대회 배너만 노출
  const toBanner = (b: { title: string; imageUrl: string | null; linkUrl: string | null }) =>
    ({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl });
  const bannerFilter = (b: { title: string }) => !b.title.includes("입점") && !b.title.includes("신규 예약");
  const topBanners = topBannerRows.filter(bannerFilter).map(toBanner);
  const bottomBanners = bottomBannerRows.filter(bannerFilter).map(toBanner);

  return (
    <>
      <MobileLandingRedirect />
      <PcLandingRedirect />
      <div className="hidden md:block">
        <CurationHome
          feedPosts={feedPosts}
          walkingPosts={walkingPosts}
          sections={sections}
          topBanners={topBanners}
          banners={bottomBanners}
          ongoingTournaments={ongoingTournaments.map((t) => ({
            id: t.id, title: t.title, type: t.type, speciesName: t.speciesName,
            startDate: t.startAt?.toISOString() ?? null,
            endDate: t.endAt?.toISOString() ?? null,
            entryCount: t._count.entries,
          }))}
          currentUserId={user?.id}
          personalizedPosts={personalizedPosts}
          userNickname={userNickname}
          userInterests={userInterests}
          hasInterests={hasInterests}
        />
      </div>
    </>
  );
}
