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
  const photo = b.photoUrl || `https://picsum.photos/seed/mycatch-${Date.now()}/800/800`;
  const lat = b.lat ?? 37.5326, lng = b.lng ?? 126.9905;

  const point = await prisma.fishingPoint.create({
    data: {
      userId: user.id, lat, lng, accuracy: b.accuracy ?? 12,
      tripId: b.tripId || null,
      speciesName: b.speciesName || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
      photoUrl: photo, gearSetup: b.gearSummary || null, region: b.region || null,
      visibility: b.pointVisibility || "EXACT",
    },
  });
  const cr = await prisma.catchRecord.create({
    data: {
      userId: user.id, fishingPointId: point.id, speciesName: b.speciesName || "미상",
      categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
      photoUrl: photo, shareToFeed: b.shareToFeed !== false,
      originalImageUrl: b.originalImageUrl || photo, measuredImageUrl: b.measuredImageUrl || photo,
      calibrationStart: b.calibrationStart ? JSON.stringify(b.calibrationStart) : null,
      calibrationEnd: b.calibrationEnd ? JSON.stringify(b.calibrationEnd) : null,
      calibrationLengthCm: b.calibrationLengthCm ?? null,
      fishHeadPoint: b.fishHeadPoint ? JSON.stringify(b.fishHeadPoint) : null,
      fishTailPoint: b.fishTailPoint ? JSON.stringify(b.fishTailPoint) : null,
      measuredLengthCm: b.measuredLengthCm ?? null, confidence: b.confidence ?? null,
      gear: b.gear ? { create: { rod: b.gear.rod, reel: b.gear.reel, line: b.gear.line, leader: b.gear.leader, lure: b.gear.lure, bait: b.gear.bait, rig: b.gear.rig, note: b.gear.note } } : undefined,
    },
  });
  let postId: string | null = null;
  if (b.shareToFeed !== false) {
    const post = await prisma.post.create({
      data: {
        authorId: user.id, postType: "FISHING_POINT", fishingPointId: point.id,
        caption: b.caption || `${b.region || ""} ${b.speciesName || ""} ${b.sizeCm || ""}cm 🎣`,
        speciesName: b.speciesName || null, fishingType: b.fishingType || null,
        categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
        region: b.region || null, lat, lng, visibility: b.visibility || "PUBLIC",
        images: { create: [{ url: photo, alt: "계측 사진", order: 0 }] },
        productTags: buildProductTags(b),
      },
    });
    postId = post.id;
  }
  return NextResponse.json({ ok: true, pointId: point.id, catchId: cr.id, postId });
}
