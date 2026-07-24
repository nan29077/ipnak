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

// 팔로워/팔로잉 목록 — 마이페이지·낚시방 상단 "팔로워 N · 팔로잉 N" 클릭 시 사용
export async function getFollowList(userId: string, kind: "followers" | "following", viewerId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, nickname: true } });
  if (!user) return null;

  const follows = kind === "followers"
    ? await prisma.follow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: "desc" },
        include: { follower: { select: { id: true, nickname: true, avatarUrl: true, bio: true, region: true } } },
      })
    : await prisma.follow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: "desc" },
        include: { following: { select: { id: true, nickname: true, avatarUrl: true, bio: true, region: true } } },
      });

  const people = follows.map((f: any) => (kind === "followers" ? f.follower : f.following));

  // 뷰어가 각 사용자를 팔로우 중인지 표시(팔로우/팔로잉 버튼용)
  let viewerFollowingIds = new Set<string>();
  if (viewerId && people.length > 0) {
    const viewerFollows = await prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: people.map((p) => p.id) } },
      select: { followingId: true },
    });
    viewerFollowingIds = new Set(viewerFollows.map((f) => f.followingId));
  }

  return {
    user: { id: user.id, nickname: user.nickname },
    people: people.map((p) => ({
      id: p.id, nickname: p.nickname, avatarUrl: p.avatarUrl, bio: p.bio, region: p.region,
      isFollowing: viewerId ? viewerFollowingIds.has(p.id) : false,
      isSelf: viewerId === p.id,
    })),
  };
}
