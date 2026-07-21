import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

// 새 형태(b.productTags: {productId,posX,posY}[]) 우선, 없으면 기존 productIds 자동 배치로 폴백
function buildProductTags(b: any) {
  if (Array.isArray(b.productTags) && b.productTags.length) {
    return {
      create: b.productTags
        .filter((t: any) => t && t.productId)
        .map((t: any) => ({ productId: t.productId, posX: clamp01(t.posX), posY: clamp01(t.posY) })),
    };
  }
  if (Array.isArray(b.productIds) && b.productIds.length) {
    return { create: b.productIds.map((pid: string, i: number) => ({ productId: pid, posX: 0.3 + (i % 3) * 0.2, posY: 0.4 })) };
  }
  return undefined;
}

export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const images: string[] = Array.isArray(b.images) && b.images.length ? b.images : [`https://picsum.photos/seed/post-${Date.now()}/800/800`];
  const post = await prisma.post.create({
    data: {
      authorId: user.id, postType: b.postType || "GENERAL", caption: b.caption || null,
      speciesName: b.speciesName || null, fishingType: b.fishingType || null,
      categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
      region: b.region || null, lat: b.lat ?? null, lng: b.lng ?? null,
      visibility: b.visibility || "PUBLIC", hashtags: b.hashtags ? JSON.stringify(b.hashtags) : null,
      images: { create: images.map((url: string, i: number) => ({ url, alt: b.caption || "낚시 사진", order: i })) },
      productTags: buildProductTags(b),
    },
  });
  return NextResponse.json({ ok: true, id: post.id });
}
