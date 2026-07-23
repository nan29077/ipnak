import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts, getWalkingFeedPosts, getPersonalizedFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { CurationHome } from "@/components/CurationHome";
import { getMainSections } from "@/lib/curation";
import { parseInterests } from "@/lib/interestsUtils";
import { MobileLandingRedirect } from "@/components/MobileLandingRedirect";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

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

  const [feedPosts, walkingPosts, sections, bannerRows, ongoingTournaments, personalizedPosts] = await Promise.all([
    getFeedPosts(user?.id, { kind: "FEED" }),
    getWalkingFeedPosts(user?.id),
    getMainSections(10),
    prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
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
  const filteredBanners = bannerRows
    .filter((b) => !b.title.includes("입점") && !b.title.includes("신규 예약"))
    .map((b) => ({ title: b.title, imageUrl: b.imageUrl }));

  return (
    <>
      <MobileLandingRedirect />
      <div className="hidden md:block">
        <CurationHome
          feedPosts={feedPosts}
          walkingPosts={walkingPosts}
          sections={sections}
          banners={filteredBanners}
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
