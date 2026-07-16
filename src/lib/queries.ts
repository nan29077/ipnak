import { prisma } from "./prisma";
import { blurCoord, safeJson } from "./utils";
import { logCategoryLabel } from "./taxonomy";

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
};

async function toFeedPost(p: any, userId?: string): Promise<FeedPost> {
  const liked = userId ? p.likes?.some((l: any) => l.userId === userId) : false;
  const saved = userId ? p.bookmarks?.some((b: any) => b.userId === userId) : false;
  let lat = p.lat, lng = p.lng, blurRadius = 0;
  if (p.lat != null && p.lng != null && p.visibility === "BLURRED") {
    const b = blurCoord(p.lat, p.lng, "BLUR_500");
    lat = b.lat; lng = b.lng; blurRadius = b.radius;
  }
  return {
    id: p.id, postType: p.postType, kind: p.kind ?? "FEED", caption: p.caption, speciesName: p.speciesName,
    fishingType: p.fishingType, categoryPath: p.categoryPath, sizeCm: p.sizeCm,
    region: p.region, lat, lng, blurRadius, visibility: p.visibility,
    title: p.title ?? null, body: p.body ?? null, boardCategory: p.boardCategory ?? null, viewCount: p.viewCount ?? 0,
    createdAt: p.createdAt.toISOString(), hashtags: safeJson<string[]>(p.hashtags, []),
    author: { id: p.author.id, nickname: p.author.nickname, avatarUrl: p.author.avatarUrl, role: p.author.role },
    images: p.images.map((im: any) => ({ id: im.id, url: im.url, alt: im.alt })),
    productTags: p.productTags.map((t: any) => ({
      id: t.id, posX: t.posX, posY: t.posY,
      product: { id: t.product.id, name: t.product.name, brand: t.product.brand, price: t.product.price, category: t.product.category, imageUrl: t.product.imageUrl, buyUrl: t.product.buyUrl },
    })),
    likeCount: p._count.likes, commentCount: p._count.comments, liked: !!liked, saved: !!saved,
  };
}

const feedInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true, role: true } },
  images: { orderBy: { order: "asc" as const } },
  productTags: { include: { product: true } },
  likes: { select: { userId: true } },
  bookmarks: { select: { userId: true } },
  _count: { select: { likes: true, comments: true } },
};

export async function getFeedPosts(userId?: string, opts?: { authorId?: string; postType?: string; savedBy?: string; kind?: string | null }) {
  const baseWhere: any = { hidden: false };
  if (opts?.authorId) baseWhere.authorId = opts.authorId;
  if (opts?.postType) baseWhere.postType = opts.postType;
  if (opts?.savedBy) baseWhere.bookmarks = { some: { userId: opts.savedBy } };
  // kind 기본값 FEED(피싱 피드). null 을 명시하면 종류 무관.
  const useKind = opts?.kind !== null;
  const where = useKind ? { ...baseWhere, kind: opts?.kind ?? "FEED" } : baseWhere;
  try {
    const posts = await prisma.post.findMany({ where, include: feedInclude, orderBy: { createdAt: "desc" }, take: 60 });
    return Promise.all(posts.map((p) => toFeedPost(p, userId)));
  } catch (e) {
    // prisma db push 전(또는 client 미재생성): kind 컬럼/필드 미존재 → kind 필터 없이 폴백
    if (!useKind) throw e;
    const posts = await prisma.post.findMany({ where: baseWhere, include: feedInclude, orderBy: { createdAt: "desc" }, take: 60 });
    return Promise.all(posts.map((p) => toFeedPost(p, userId)));
  }
}

export async function getPost(id: string, userId?: string) {
  const p = await prisma.post.findUnique({ where: { id }, include: feedInclude });
  if (!p) return null;
  return toFeedPost(p, userId);
}

// ===== 조행기(LOG) =====
export type LogListItem = {
  id: string; title: string; boardCategory: string | null; boardLabel: string;
  region: string | null; createdAt: string; viewCount: number;
  commentCount: number; likeCount: number; thumbnail: string | null; imageCount: number;
  excerpt: string;
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
    author: { id: p.author.id, nickname: p.author.nickname, avatarUrl: p.author.avatarUrl },
  };
}

export async function getLogPosts(opts?: { category?: string | null; authorId?: string }): Promise<LogListItem[]> {
  const where: any = { hidden: false, kind: "LOG" };
  if (opts?.category) where.boardCategory = opts.category;
  if (opts?.authorId) where.authorId = opts.authorId;
  try {
    const posts = await prisma.post.findMany({ where, include: logListInclude, orderBy: { createdAt: "desc" }, take: 80 });
    return (posts as any[]).map(toLogListItem);
  } catch {
    // prisma db push 전: kind/boardCategory 미존재 → 빈 목록으로 graceful 처리
    return [];
  }
}

// 조행기 상세 — 조회수 1 증가 후 반환
export async function getLogPost(id: string, userId?: string): Promise<FeedPost | null> {
  try {
    const exists = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return null;
    await prisma.post.update({ where: { id }, data: ({ viewCount: { increment: 1 } } as any) }).catch(() => {});
    const p = await prisma.post.findUnique({ where: { id }, include: feedInclude });
    if (!p) return null;
    return toFeedPost(p, userId);
  } catch {
    return null;
  }
}

export async function getLogCategoryCounts(): Promise<Record<string, number>> {
  const rows = await (prisma.post as any).groupBy({
    by: ["boardCategory"],
    where: { hidden: false, kind: "LOG" },
    _count: { _all: true },
  }).catch(() => [] as any[]);
  const out: Record<string, number> = {};
  for (const r of rows as any[]) out[r.boardCategory ?? "FREE"] = r._count?._all ?? 0;
  return out;
}
