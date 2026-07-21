import { prisma } from "./prisma";
import { safeJson } from "./utils";

export async function getProfileData(userId: string, viewerId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [postCount, followerCount, followingCount, posts, points, entries, isFollowing, catchRecords] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, hidden: false } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.post.findMany({
      where: { authorId: userId, hidden: false }, orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { order: "asc" }, take: 1 } }, take: 60,
    }),
    prisma.fishingPoint.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { posts: { select: { id: true }, take: 1 } }, take: 60 }),
    prisma.tournamentEntry.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, include: { tournament: true }, take: 30,
    }),
    viewerId ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: userId } } }) : null,
    prisma.catchRecord.findMany({ where: { userId }, select: { speciesName: true, sizeCm: true, measuredLengthCm: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  // 대표 어종: 게시글 + 캐치 레코드 어종 합산
  const speciesCount: Record<string, number> = {};
  posts.forEach((p) => { if (p.speciesName) speciesCount[p.speciesName] = (speciesCount[p.speciesName] || 0) + 1; });
  catchRecords.forEach((c) => { if (c.speciesName) speciesCount[c.speciesName] = (speciesCount[c.speciesName] || 0) + 1; });
  const topSpecies = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // 최대 어획 크기: 게시글 + 피싱포인트 + 캐치레코드 모두 합산
  const maxSize = Math.max(
    0,
    ...posts.map((p) => p.sizeCm ?? 0),
    ...points.map((p) => p.sizeCm ?? 0),
    ...catchRecords.map((c) => c.measuredLengthCm ?? c.sizeCm ?? 0),
  );

  return {
    user: {
      id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, bio: user.bio,
      region: user.region, role: user.role, interests: safeJson<string[]>(user.interests, []),
    },
    stats: { postCount, followerCount, followingCount, topSpecies, maxSize: maxSize || null, pointCount: points.length, catchCount: catchRecords.length },
    posts: posts.map((p) => ({ id: p.id, image: p.images[0]?.url ?? null, postType: p.postType, sizeCm: p.sizeCm, speciesName: p.speciesName, body: p.body ?? null })),
    points: points.map((p) => ({ id: p.posts[0]?.id ?? p.id, image: p.photoUrl, postType: "FISHING_POINT", sizeCm: p.sizeCm, speciesName: p.speciesName })),
    entries: entries.map((e) => ({ id: e.id, tournamentId: e.tournamentId, title: e.tournament.title, speciesName: e.speciesName, sizeCm: e.sizeCm, status: e.status })),
    isFollowing: !!isFollowing,
  };
}
