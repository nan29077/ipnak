import { prisma } from "./prisma";
import { blurCoord, safeJson } from "./utils";
import { logCategoryLabel } from "./taxonomy";
import { buildLocationStaticMapUrl, STATIC_MAP_DOMAIN } from "./map";
import { pointsEnabled, walkingUnlockedSet } from "./points";
import {
  excludeVirtualCountWhere, excludeVirtualLikeCountWhere,
  excludeVirtualWhere, isVirtualHiddenPost,
} from "./virtualVisibility";

/**
 * 해시태그 검색어 서버측 정규화.
 * hashtags 는 SQLite 에 JSON 배열 문자열(["부산","배스"])로 저장되므로 LIKE 부분 일치로 찾는다.
 * JSON 구분자(" \ [ ] ,)는 태그 값 안에 들어갈 수 없는 문자이므로 미리 걷어내
 * 구분자를 넘나드는 오탐(예: `","` 로 전체 매칭)을 막는다.
 */
export function normalizeTagParam(tag?: string | null): string {
  return (tag ?? "").trim().replace(/^#+/, "").replace(/["\\[\],]/g, "").trim();
}

/** 해시태그 검색 where 조각 — 검색어가 비면 빈 객체(=필터 없음) */
function hashtagWhere(tag?: string | null): { hashtags?: { contains: string } } {
  const key = normalizeTagParam(tag);
  return key ? { hashtags: { contains: key } } : {};
}

export type FeedProductTag = {
  id: string; posX: number; posY: number;
  product: { id: string; name: string; brand: string | null; price: number; category: string; imageUrl: string | null; buyUrl: string | null };
};

export type FeedPost = {
  id: string; postType: string; kind: string; caption: string | null; speciesName: string | null;
  fishingType: string | null; categoryPath: string | null; sizeCm: number | null;
  region: string | null; lat: number | null; lng: number | null; blurRadius: number;
  visibility: string; createdAt: string; hashtags: string[];
  // 조행기(LOG) 전용
  title: string | null; body: string | null; boardCategory: string | null; viewCount: number;
  author: { id: string; nickname: string; avatarUrl: string | null; role: string };
  images: { id: string; url: string; alt: string | null }[];
  productTags: FeedProductTag[];
  likeCount: number; commentCount: number; liked: boolean; saved: boolean;
  // 워킹 피드 잠금: true 이면 현재 열람자가 200P 를 지불해야 볼 수 있는 상태
  walkingLocked: boolean;
  // 워킹 피드 GPS 기반 수계명 캐시 ("영산강") — 잠금 카드의 "OO 인근" 표시에 사용
  locationLabel: string | null;
};

async function toFeedPost(p: any, userId?: string, walkingLocked = false): Promise<FeedPost> {
  const liked = userId ? p.likes?.some((l: any) => l.userId === userId) : false;
  const saved = userId ? p.bookmarks?.some((b: any) => b.userId === userId) : false;
  let lat = p.lat, lng = p.lng, blurRadius = 0;
  if (p.lat != null && p.lng != null && p.visibility === "BLURRED") {
    const b = blurCoord(p.lat, p.lng, "BLUR_500");
    lat = b.lat; lng = b.lng; blurRadius = b.radius;
  }

  // 워킹 피드 잠금: 서버에서 본문/이미지를 차단한다 (클라이언트 렌더링만으로는 우회 가능하므로)
  const isLockedWalking = walkingLocked && p.postType === "WALKING_FEED";

  return {
    id: p.id, postType: p.postType, kind: p.kind ?? "FEED", caption: p.caption, speciesName: p.speciesName,
    fishingType: p.fishingType, categoryPath: p.categoryPath, sizeCm: p.sizeCm,
    region: p.region,
    // 잠긴 워킹피드: 정확한 좌표 대신 지역 정보만 제공
    lat: isLockedWalking ? null : lat,
    lng: isLockedWalking ? null : lng,
    blurRadius, visibility: p.visibility,
    title: p.title ?? null,
    // 잠긴 워킹피드: 본문 차단
    body: isLockedWalking ? null : (p.body ?? null),
    boardCategory: p.boardCategory ?? null, viewCount: p.viewCount ?? 0,
    createdAt: p.createdAt.toISOString(), hashtags: safeJson<string[]>(p.hashtags, []),
    author: { id: p.author.id, nickname: p.author.nickname, avatarUrl: p.author.avatarUrl, role: p.author.role },
    images: (() => {
      let imgs = p.images.map((im: any) => ({ id: im.id, url: im.url, alt: im.alt })) as { id: string; url: string; alt: string | null }[];
      // 잠긴 워킹피드: 첫 번째 썸네일만 미리보기로 제공, 나머지는 차단
      if (isLockedWalking) return imgs.slice(0, 1);
      // FISHING_POINT 포스트 — lat/lng 존재 & 첫 이미지가 정적맵이 아니면 지도 URL 소급 삽입
      if (p.postType === "FISHING_POINT" && lat != null && lng != null) {
        if (!imgs[0]?.url?.includes(STATIC_MAP_DOMAIN)) {
          imgs = [{ id: `map_${p.id}`, url: buildLocationStaticMapUrl(lat, lng), alt: "낚시 포인트 지도" }, ...imgs];
        }
      }
      return imgs;
    })(),
    productTags: p.productTags.map((t: any) => ({
      id: t.id, posX: t.posX, posY: t.posY,
      product: { id: t.product.id, name: t.product.name, brand: t.product.brand, price: t.product.price, category: t.product.category, imageUrl: t.product.imageUrl, buyUrl: t.product.buyUrl },
    })),
    likeCount: p._count.likes, commentCount: p._count.comments, liked: !!liked, saved: !!saved,
    walkingLocked,
    // 수계명은 좌표가 아니므로 잠금 상태에서도 제공한다 (잠금 카드에 "OO강 인근" 표시)
    locationLabel: p.locationLabel ?? null,
  };
}

/**
 * 워킹 피드 글의 열람자별 잠금 상태를 계산한다.
 * 포인트 제도 ON + 열람자가 작성자 본인이 아님 + 아직 열람(해제)하지 않음 → 잠김.
 * 비로그인 열람자도 잠김으로 처리(로그인 유도).
 */
async function computeWalkingLocks(posts: any[], userId?: string): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const walking = posts.filter((p) => p.postType === "WALKING_FEED");
  if (walking.length === 0) return map;
  if (!(await pointsEnabled())) return map; // 제도 OFF → 전부 열람 가능
  const unlocked = await walkingUnlockedSet(userId, walking.map((p) => p.id));

  // 낚시단 공유 워킹 피드: 해당 낚시단 단원(또는 단장)이면 무료 열람
  let memberGroupIds = new Set<string>();
  if (userId) {
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId, role: { in: ["leader", "member"] } },
        select: { groupId: true },
      });
      memberGroupIds = new Set(memberships.map((m) => m.groupId));
    } catch { /* 테이블 미생성 등 → 무료 열람 없이 계속 진행 */ }
  }

  for (const p of walking) {
    const isAuthor = userId && p.authorId === userId;
    const alreadyUnlocked = unlocked.has(p.id);
    // 낚시단에 공유된 워킹 피드이고 해당 낚시단 소속 단원이면 무료 열람
    const isGroupFree = p.sharedGroupId != null && memberGroupIds.has(p.sharedGroupId);
    map.set(p.id, !isAuthor && !alreadyUnlocked && !isGroupFree);
  }
  return map;
}

// likes/bookmarks는 "현재 열람자가 눌렀는지" 판별에만 쓰이므로 열람자 것만 조회
// (전체 좋아요 수는 _count로 별도 집계 — 게시글당 전체 좋아요 행을 로드하지 않아 쿼리 페이로드 대폭 절감)
const feedInclude = (userId?: string) => ({
  author: { select: { id: true, nickname: true, avatarUrl: true, role: true } },
  // toFeedPost 가 쓰는 3개 컬럼만 — 목록 응답에서 쓰지 않는 postId/order 는 제외
  images: { select: { id: true, url: true, alt: true }, orderBy: { order: "asc" as const } },
  // product 전체를 싣지 않는다 — description·options 등 큰 컬럼이 게시글 수만큼 붙는다
  productTags: {
    select: {
      id: true, posX: true, posY: true,
      product: { select: { id: true, name: true, brand: true, price: true, category: true, imageUrl: true, buyUrl: true } },
    },
  },
  likes: { where: { userId: userId ?? "" }, select: { userId: true } },
  bookmarks: { where: { userId: userId ?? "" }, select: { userId: true } },
  _count: { select: { likes: true, comments: true } },
});

/**
 * feedInclude 와 같지만 좋아요·댓글 수에서 가상회원이 남긴 것을 제외한다.
 * 글로벌 스위치가 OFF 일 때 카드에 표시되는 숫자와 실제 보이는 댓글 수를 일치시킨다.
 * (스위치가 ON 이면 필터 조각이 true 가 되어 기존과 완전히 동일한 쿼리가 된다.)
 */
async function feedIncludeFiltered(userId?: string) {
  const [commentCountWhere, likeCountWhere] = await Promise.all([
    excludeVirtualCountWhere(),
    excludeVirtualLikeCountWhere(),
  ]);
  return {
    ...feedInclude(userId),
    _count: { select: { likes: likeCountWhere, comments: commentCountWhere } },
  } as ReturnType<typeof feedInclude>;
}

export async function getFeedPosts(userId?: string, opts?: { authorId?: string; postType?: string; savedBy?: string; kind?: string | null }) {
  // 가상회원 글로벌 스위치가 OFF 면 가상회원 작성분을 제외한다.
  // 단, 특정 작성자를 지정한 조회(본인 프로필 등)는 그 사람 글을 보러 온 것이므로 그대로 둔다.
  const baseWhere: any = { hidden: false, ...(opts?.authorId ? {} : await excludeVirtualWhere("author")) };
  if (opts?.postType) baseWhere.postType = opts.postType;
  else baseWhere.postType = { notIn: ["WALKING_FEED", "FISHING_POINT"] };
  if (opts?.savedBy) baseWhere.bookmarks = { some: { userId: opts.savedBy } };

  // ── 공개 범위 필터 ──────────────────────────────────────────────────
  // PUBLIC·BLURRED: 누구나 볼 수 있음
  // FOLLOWERS: 작성자를 팔로우하는 사람만 + 본인
  // PRIVATE: 본인만
  if (userId) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    baseWhere.OR = [
      { visibility: { in: ["PUBLIC", "BLURRED"] } },
      { AND: [{ visibility: "FOLLOWERS" }, { authorId: { in: followingIds } }] },
      { authorId: userId }, // 본인 게시물은 공개범위 무관 노출
    ];
  } else {
    // 비로그인: 전체공개 + 위치흐림만
    baseWhere.visibility = { in: ["PUBLIC", "BLURRED"] };
  }
  // ─────────────────────────────────────────────────────────────────────

  if (opts?.authorId) baseWhere.authorId = opts.authorId;

  const useKind = opts?.kind !== null;
  const where = useKind ? { ...baseWhere, kind: opts?.kind ?? "FEED" } : baseWhere;
  const include = await feedIncludeFiltered(userId);
  try {
    const posts = await prisma.post.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 60 });
    return Promise.all(posts.map((p) => toFeedPost(p, userId)));
  } catch (e) {
    if (!useKind) throw e;
    const posts = await prisma.post.findMany({ where: baseWhere, include, orderBy: { createdAt: "desc" }, take: 60 });
    return Promise.all(posts.map((p) => toFeedPost(p, userId)));
  }
}

/**
 * 맞춤 추천 피드 — 사용자의 관심 어종/낚시 방식 기반
 * - species 목록과 speciesName 매칭
 * - methods 목록은 hashtags/caption 포함 여부로 매칭
 * - 최신 + 인기 순으로 최대 20개 반환
 */
export async function getPersonalizedFeedPosts(
  userId: string,
  interests: { methods: string[]; species: string[] }
): Promise<FeedPost[]> {
  const { methods, species } = interests;
  if (species.length === 0 && methods.length === 0) return [];

  const orConditions: any[] = [];

  // 어종 매칭
  if (species.length > 0) {
    orConditions.push({ speciesName: { in: species } });
  }

  // 낚시 방식 — hashtags(JSON) 또는 caption에 포함
  for (const m of methods) {
    orConditions.push({ caption: { contains: m } });
    orConditions.push({ hashtags: { contains: m } });
  }

  try {
    const posts = await prisma.post.findMany({
      where: {
        hidden: false,
        postType: { notIn: ["WALKING_FEED"] },
        // 맞춤 추천 피드에서도 비공개/팔로워전용 글은 미노출
        visibility: { in: ["PUBLIC", "BLURRED"] },
        ...(await excludeVirtualWhere("author")),
        OR: orConditions,
      },
      include: await feedIncludeFiltered(userId),
      orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
      take: 20,
    });
    return Promise.all(posts.map((p) => toFeedPost(p, userId)));
  } catch {
    return [];
  }
}

export async function getPost(id: string, userId?: string) {
  const p = await prisma.post.findUnique({ where: { id }, include: await feedIncludeFiltered(userId) });
  if (!p) return null;
  // 목록에서만 숨기면 링크·검색으로 뚫리므로 상세 진입도 막는다(본인 글은 예외).
  if (await isVirtualHiddenPost(p, userId)) return null;

  // F-C1: 공개범위·숨김 검증 (URL 직접 접근 우회 방지)
  const post = p as any;
  if (post.hidden && post.authorId !== userId) return null;
  if (post.visibility === "PRIVATE" && post.authorId !== userId) return null;
  if (post.visibility === "FOLLOWERS" && post.authorId !== userId) {
    if (!userId) return null;
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: post.authorId } },
    });
    if (!follow) return null;
  }

  const locks = await computeWalkingLocks([p], userId);
  return toFeedPost(p, userId, locks.get(p.id) ?? false);
}

/** 스마트피싱 기록에서 생성된 워킹 피드 포스트 (kind: "WALKING" / postType: "WALKING_FEED") */
export async function getWalkingFeedPosts(userId?: string, opts?: { authorId?: string }, limit = 12): Promise<FeedPost[]> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        hidden: false,
        postType: "WALKING_FEED",
        // 기록 종료 시 자동 생성된 글은 PRIVATE로 시작한다 → 공개 전에는 작성자 본인에게만 보인다.
        // 기존 글(수동 게시·더미)은 모두 PUBLIC 이므로 영향 없음.
        ...(userId
          ? { OR: [{ visibility: { in: ["PUBLIC", "BLURRED"] } }, { authorId: userId }] }
          : { visibility: { in: ["PUBLIC", "BLURRED"] } }),
        ...(opts?.authorId ? { authorId: opts.authorId } : await excludeVirtualWhere("author")),
      },
      include: await feedIncludeFiltered(userId),
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const locks = await computeWalkingLocks(posts, userId);
    return Promise.all(posts.map((p) => toFeedPost(p, userId, locks.get(p.id) ?? false)));
  } catch {
    return [];
  }
}

// ===== 조행기(LOG) =====
export type LogListItem = {
  id: string; title: string; boardCategory: string | null; boardLabel: string;
  region: string | null; createdAt: string; viewCount: number;
  commentCount: number; likeCount: number; thumbnail: string | null; imageCount: number;
  excerpt: string; hashtags: string[];
  author: { id: string; nickname: string; avatarUrl: string | null };
};

const logListInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true } },
  images: { orderBy: { order: "asc" as const }, take: 1 },
  _count: { select: { likes: true, comments: true } },
};

function toLogListItem(p: any): LogListItem {
  const body: string = (p.body ?? "").replace(/\s+/g, " ").trim();
  return {
    id: p.id,
    title: p.title || (p.caption ? p.caption.slice(0, 40) : "(제목 없음)"),
    boardCategory: p.boardCategory ?? null,
    boardLabel: logCategoryLabel(p.boardCategory),
    region: p.region ?? null,
    createdAt: p.createdAt.toISOString(),
    viewCount: p.viewCount ?? 0,
    commentCount: p._count?.comments ?? 0,
    likeCount: p._count?.likes ?? 0,
    thumbnail: p.images?.[0]?.url ?? null,
    imageCount: p.images?.length ?? 0,
    excerpt: body.slice(0, 90),
    hashtags: safeJson<string[]>(p.hashtags, []),
    author: { id: p.author.id, nickname: p.author.nickname, avatarUrl: p.author.avatarUrl },
  };
}

export async function getLogPosts(opts?: { category?: string | null; authorId?: string }, userId?: string): Promise<LogListItem[]> {
  const where: any = { hidden: false, kind: "LOG" };
  if (opts?.category) where.boardCategory = opts.category;
  if (opts?.authorId) where.authorId = opts.authorId;
  else Object.assign(where, await excludeVirtualWhere("author"));

  // 공개범위 필터 (authorId 지정 시 본인 프로필이므로 필터 생략)
  if (!opts?.authorId) {
    if (userId) {
      const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
      const followingIds = following.map((f) => f.followingId);
      where.OR = [
        { visibility: { in: ["PUBLIC", "BLURRED"] } },
        { AND: [{ visibility: "FOLLOWERS" }, { authorId: { in: followingIds } }] },
        { authorId: userId },
      ];
    } else {
      where.visibility = { in: ["PUBLIC", "BLURRED"] };
    }
  }

  try {
    const [likeWhere, commentWhere] = await Promise.all([excludeVirtualLikeCountWhere(), excludeVirtualCountWhere()]);
    const posts = await prisma.post.findMany({
      where,
      include: { ...logListInclude, _count: { select: { likes: likeWhere, comments: commentWhere } } },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return (posts as any[]).map(toLogListItem);
  } catch {
    // prisma db push 전: kind/boardCategory 미존재 → 빈 목록으로 graceful 처리
    return [];
  }
}

// 조행기 상세 — 조회수 1 증가 후 반환
export async function getLogPost(id: string, userId?: string): Promise<FeedPost | null> {
  try {
    const exists = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, visibility: true, hidden: true },
    });
    if (!exists) return null;
    // 숨김 대상이면 조회수도 올리지 않고 바로 막는다.
    if (await isVirtualHiddenPost(exists, userId)) return null;

    // 공개범위 검증 (조행기도 피드와 동일한 가시성 규칙 적용)
    const e = exists as any;
    if (e.hidden && e.authorId !== userId) return null;
    if (e.visibility === "PRIVATE" && e.authorId !== userId) return null;
    if (e.visibility === "FOLLOWERS" && e.authorId !== userId) {
      if (!userId) return null;
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId, followingId: e.authorId } },
      });
      if (!follow) return null;
    }

    await prisma.post.update({ where: { id }, data: ({ viewCount: { increment: 1 } } as any) }).catch(() => {});
    const p = await prisma.post.findUnique({ where: { id }, include: await feedIncludeFiltered(userId) });
    if (!p) return null;
    return toFeedPost(p, userId);
  } catch {
    return null;
  }
}

export async function getLogCategoryCounts(): Promise<Record<string, number>> {
  const rows = await (prisma.post as any).groupBy({
    by: ["boardCategory"],
    where: { hidden: false, kind: "LOG", ...(await excludeVirtualWhere("author")) },
    _count: { _all: true },
  }).catch(() => [] as any[]);
  const out: Record<string, number> = {};
  for (const r of rows as any[]) out[r.boardCategory ?? "FREE"] = r._count?._all ?? 0;
  return out;
}

// ===== cursor 기반 페이지네이션 =====

/** 피싱피드 / 일상피드 페이지 단위 조회 */
export async function getFeedPostsPage(
  userId?: string,
  opts?: { authorId?: string; postType?: string; savedBy?: string; kind?: string | null; tag?: string },
  cursor?: string,
  limit = 20
): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const baseWhere: any = { hidden: false };
  if (opts?.postType) baseWhere.postType = opts.postType;
  else baseWhere.postType = { notIn: ["WALKING_FEED", "FISHING_POINT"] };
  if (opts?.savedBy) baseWhere.bookmarks = { some: { userId: opts.savedBy } };

  if (userId) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    baseWhere.OR = [
      { visibility: { in: ["PUBLIC", "BLURRED"] } },
      { AND: [{ visibility: "FOLLOWERS" }, { authorId: { in: followingIds } }] },
      { authorId: userId },
    ];
  } else {
    baseWhere.visibility = { in: ["PUBLIC", "BLURRED"] };
  }

  if (opts?.authorId) baseWhere.authorId = opts.authorId;
  else Object.assign(baseWhere, await excludeVirtualWhere("author"));

  // 해시태그 서버사이드 검색 — 공개범위 OR 조건과는 AND 로 묶인다
  Object.assign(baseWhere, hashtagWhere(opts?.tag));

  const useKind = opts?.kind !== null;
  const where = useKind ? { ...baseWhere, kind: opts?.kind ?? "FEED" } : baseWhere;
  // 유니온({cursor,skip} | {})으로 추론되면 스프레드 시 findMany 인자 타입이 깨진다 → 선택 필드로 명시
  const cursorClause: { cursor?: { id: string }; skip?: number } = cursor ? { cursor: { id: cursor }, skip: 1 } : {};
  const include = await feedIncludeFiltered(userId);

  const fetchAndPaginate = async (w: any) => {
    const raw = await prisma.post.findMany({
      where: w, include, orderBy: { createdAt: "desc" },
      take: limit + 1, ...cursorClause,
    });
    const hasMore = raw.length > limit;
    const items = hasMore ? raw.slice(0, limit) : raw;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    const posts = await Promise.all(items.map((p) => toFeedPost(p, userId)));
    return { posts, nextCursor };
  };

  try {
    return await fetchAndPaginate(where);
  } catch (e) {
    if (!useKind) throw e;
    return await fetchAndPaginate(baseWhere);
  }
}

/** 조행기 페이지 단위 조회 */
export async function getLogPostsPage(
  opts?: { category?: string | null; authorId?: string; tag?: string },
  cursor?: string,
  limit = 20,
  userId?: string,
): Promise<{ posts: LogListItem[]; nextCursor: string | null }> {
  const where: any = { hidden: false, kind: "LOG" };
  if (opts?.category) where.boardCategory = opts.category;
  if (opts?.authorId) where.authorId = opts.authorId;
  else Object.assign(where, await excludeVirtualWhere("author"));

  // 공개범위 필터 (authorId 지정 시 본인 프로필이므로 필터 생략)
  if (!opts?.authorId) {
    if (userId) {
      const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
      const followingIds = following.map((f) => f.followingId);
      where.OR = [
        { visibility: { in: ["PUBLIC", "BLURRED"] } },
        { AND: [{ visibility: "FOLLOWERS" }, { authorId: { in: followingIds } }] },
        { authorId: userId },
      ];
    } else {
      where.visibility = { in: ["PUBLIC", "BLURRED"] };
    }
  }

  // 해시태그 서버사이드 검색
  Object.assign(where, hashtagWhere(opts?.tag));

  // 유니온({cursor,skip} | {})으로 추론되면 스프레드 시 findMany 인자 타입이 깨진다 → 선택 필드로 명시
  const cursorClause: { cursor?: { id: string }; skip?: number } = cursor ? { cursor: { id: cursor }, skip: 1 } : {};
  try {
    const [likeWhere, commentWhere] = await Promise.all([excludeVirtualLikeCountWhere(), excludeVirtualCountWhere()]);
    const raw = await prisma.post.findMany({
      where,
      include: { ...logListInclude, _count: { select: { likes: likeWhere, comments: commentWhere } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1, ...cursorClause,
    });
    const hasMore = raw.length > limit;
    const items = hasMore ? raw.slice(0, limit) : raw;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { posts: (items as any[]).map(toLogListItem), nextCursor };
  } catch {
    return { posts: [], nextCursor: null };
  }
}

/** 워킹 피드 페이지 단위 조회 */
export async function getWalkingFeedPostsPage(
  userId?: string,
  opts?: { authorId?: string; tag?: string },
  cursor?: string,
  limit = 12
): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  // 유니온({cursor,skip} | {})으로 추론되면 스프레드 시 findMany 인자 타입이 깨진다 → 선택 필드로 명시
  const cursorClause: { cursor?: { id: string }; skip?: number } = cursor ? { cursor: { id: cursor }, skip: 1 } : {};
  try {
    const raw = await prisma.post.findMany({
      where: {
        hidden: false,
        postType: "WALKING_FEED",
        ...(userId
          ? { OR: [{ visibility: { in: ["PUBLIC", "BLURRED"] } }, { authorId: userId }] }
          : { visibility: { in: ["PUBLIC", "BLURRED"] } }),
        ...(opts?.authorId ? { authorId: opts.authorId } : await excludeVirtualWhere("author")),
        // 해시태그 서버사이드 검색
        ...hashtagWhere(opts?.tag),
      },
      include: await feedIncludeFiltered(userId),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...cursorClause,
    });
    const hasMore = raw.length > limit;
    const items = hasMore ? raw.slice(0, limit) : raw;
    const locks = await computeWalkingLocks(items, userId);
    const posts = await Promise.all(items.map((p) => toFeedPost(p, userId, locks.get(p.id) ?? false)));
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { posts, nextCursor };
  } catch {
    return { posts: [], nextCursor: null };
  }
}
