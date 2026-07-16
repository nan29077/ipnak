import { prisma } from "./prisma";
import { blurCoord, safeJson } from "./utils";

export type FeedProductTag = {
  id: string; posX: number; posY: number;
  product: { id: string; name: string; brand: string | null; price: number; category: string; imageUrl: string | null; buyUrl: string | null };
};

export type FeedPost = {
  id: string; postType: string; caption: string | null; speciesName: string | null;
  fishingType: string | null; categoryPath: string | null; sizeCm: number | null;
  region: string | null; lat: number | null; lng: number | null; blurRadius: number;
  visibility: string; createdAt: string; hashtags: string[];
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
    id: p.id, postType: p.postType, caption: p.caption, speciesName: p.speciesName,
    fishingType: p.fishingType, categoryPath: p.categoryPath, sizeCm: p.sizeCm,
    region: p.region, lat, lng, blurRadius, visibility: p.visibility,
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

export async function getFeedPosts(userId?: string, opts?: { authorId?: string; postType?: string; savedBy?: string }) {
  const where: any = { hidden: false };
  if (opts?.authorId) where.authorId = opts.authorId;
  if (opts?.postType) where.postType = opts.postType;
  if (opts?.savedBy) where.bookmarks = { some: { userId: opts.savedBy } };
  const posts = await prisma.post.findMany({ where, include: feedInclude, orderBy: { createdAt: "desc" }, take: 60 });
  return Promise.all(posts.map((p) => toFeedPost(p, userId)));
}

export async function getPost(id: string, userId?: string) {
  const p = await prisma.post.findUnique({ where: { id }, include: feedInclude });
  if (!p) return null;
  return toFeedPost(p, userId);
}
