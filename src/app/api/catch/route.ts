import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";
import { awardPostReward } from "@/lib/points";
import { getBoolSetting } from "@/lib/settings";
import { resolveWeightG, speciesKeyFromName } from "@/lib/weightEstimation";

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
  const shopTagEnabled = await getBoolSetting("shop_tag_enabled");
  const b = await req.json().catch(() => ({}));
  // 쇼핑 태그 OFF 시: 403 대신 태그만 무효화해 기록 저장 자체는 정상 처리
  if (!shopTagEnabled) { b.productTags = []; b.productIds = []; }
  const photo = b.photoUrl || `https://picsum.photos/seed/mycatch-${Date.now()}/800/800`;
  const lat = b.lat ?? 37.5326, lng = b.lng ?? 126.9905;

  // 추정 무게(g) — 클라이언트 값이 없으면 길이·너비·어종으로 서버에서 산출
  const weightKey = b.species || speciesKeyFromName(b.speciesName);
  const bodyWidth = b.bodyWidth != null && Number(b.bodyWidth) > 0 ? Number(b.bodyWidth) : null;
  const estimatedWeight = resolveWeightG({
    estimatedWeight: b.estimatedWeight != null ? Number(b.estimatedWeight) : null,
    species: weightKey, speciesName: b.speciesName,
    lengthCm: b.sizeCm ?? b.measuredLengthCm,
    bodyWidthCm: bodyWidth,
  });

  // fishingPoint + catchRecord + post(shareToFeed 시)를 원자적으로 생성
  // awardPostReward 는 내부적으로 changePoints → prisma.$transaction() 을 자체 생성하므로
  // 외부 트랜잭션에 포함 불가 — 트랜잭션 완료 후 별도 실행한다.
  const { point, cr, postId } = await prisma.$transaction(async (tx) => {
    const point = await tx.fishingPoint.create({
      data: {
        userId: user.id, lat, lng, accuracy: b.accuracy ?? 12,
        tripId: b.tripId || null,
        speciesName: b.speciesName || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
        photoUrl: photo, gearSetup: b.gearSummary || null, region: b.region || null,
        visibility: b.pointVisibility || "EXACT",
      },
    });

    const cr = await tx.catchRecord.create({
      data: {
        userId: user.id, fishingPointId: point.id, speciesName: b.speciesName || "미상",
        species: weightKey || null, estimatedWeight: estimatedWeight ?? null,
        categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
        bodyWidth,
        photoUrl: photo, shareToFeed: b.shareToFeed !== false,
        originalImageUrl: b.originalImageUrl || photo, measuredImageUrl: b.measuredImageUrl || photo,
        calibrationStart: b.calibrationStart ? JSON.stringify(b.calibrationStart) : null,
        calibrationEnd: b.calibrationEnd ? JSON.stringify(b.calibrationEnd) : null,
        calibrationLengthCm: b.calibrationLengthCm ?? null,
        fishHeadPoint: b.fishHeadPoint ? JSON.stringify(b.fishHeadPoint) : null,
        fishTailPoint: b.fishTailPoint ? JSON.stringify(b.fishTailPoint) : null,
        measuredLengthCm: b.measuredLengthCm ?? null, confidence: b.confidence ?? null,
        ballId: b.ballId || null,
        gear: b.gear ? { create: { rod: b.gear.rod, reel: b.gear.reel, line: b.gear.line, leader: b.gear.leader, lure: b.gear.lure, bait: b.gear.bait, rig: b.gear.rig, note: b.gear.note } } : undefined,
      },
    });

    let postId: string | null = null;
    if (b.shareToFeed !== false) {
      const feedPost = await tx.post.create({
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
      postId = feedPost.id;
    }

    return { point, cr, postId };
  });

  // 키링 모드 측정 — keyringId 는 Prisma 가 모르는 raw 컬럼이라 트랜잭션 뒤 raw UPDATE 로 기록.
  // 실패해도 기록 저장 자체는 성공 처리한다.
  if (b.keyringId) {
    try {
      await ensureKeyringTables();
      await prisma.$executeRawUnsafe(
        `UPDATE \`CatchRecord\` SET \`keyringId\` = ? WHERE \`id\` = ?`,
        String(b.keyringId), cr.id
      );
    } catch { /* noop */ }
  }

  // tripId가 있으면 출조 기록의 catchCount 자동 증가 (기록 종료 후 물고기 저장 케이스 대응)
  if (b.tripId) {
    prisma.fishingTrip.update({
      where: { id: String(b.tripId), userId: user.id },
      data: { catchCount: { increment: 1 } },
    }).catch(() => {});
  }

  // 피드 글 작성 적립 (하루 5회 한도, 포인트 제도 ON 일 때만) — 실패해도 기록 저장은 성공 처리
  // awardPostReward 내부에서 별도 prisma.$transaction 을 사용하므로 외부 트랜잭션에 포함 불가
  let pointsEarned = 0;
  if (postId) {
    pointsEarned = (await awardPostReward(user.id, postId)) ?? 0;
  }

  return NextResponse.json({ ok: true, pointId: point.id, catchId: cr.id, postId, pointsEarned });
}
