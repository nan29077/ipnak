import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts, getWalkingFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { CurationHome } from "@/components/CurationHome";
import { getMainSections } from "@/lib/curation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [feedPosts, walkingPosts, sections, bannerRows, ongoingTournaments] = await Promise.all([
    getFeedPosts(user?.id, { kind: "FEED" }),
    getWalkingFeedPosts(user?.id),
    getMainSections(10),
    prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.tournament.findMany({
      where: { status: "ONGOING" },
      orderBy: { startAt: "asc" },
      include: { _count: { select: { entries: true } } },
    }).catch(() => []),
  ]);

  // "입점" 관련 배너는 제외 — 대회 배너만 노출
  const filteredBanners = bannerRows
    .filter((b) => !b.title.includes("입점") && !b.title.includes("신규 예약"))
    .map((b) => ({ title: b.title, imageUrl: b.imageUrl }));

  return (
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
    />
  );
}
