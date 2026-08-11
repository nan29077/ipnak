import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";
import { ensureCatchEnvColumns, CATCH_ENV_COLUMNS } from "@/lib/ensureCatchEnvColumns";
import { awardPostReward } from "@/lib/points";
import { getBoolSetting } from "@/lib/settings";
import { resolveWeightG, speciesKeyFromName } from "@/lib/weightEstimation";

export const dynamic = "force-dynamic";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

/** 환경 정보 숫자 필드 정규화 — 빈 문자열·NaN·무한대는 저장하지 않는다 */
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 계측일지에서 가져갈 최대 서버 기록 수 */
const DIARY_MAX = 200;

// GET /api/catch — 내 조과 기록 목록 (계측일지에서 로컬 기록과 병합해 표시)
// 기기 localStorage 에만 있던 계측일지를 다른 기기·재설치 후에도 볼 수 있게 하는 서버 소스다.
export async function GET(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isFinite(limitParam) ? Math.min(DIARY_MAX, Math.max(1, limitParam)) : DIARY_MAX;

  const rows = await prisma.catchRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, speciesName: true, sizeCm: true, measuredLengthCm: true, estimatedWeight: true,
      bodyWidth: true, photoUrl: true, measuredImageUrl: true, confidence: true, ballId: true, createdAt: true,
      fishingPoint: { select: { lat: true, lng: true, region: true } },
    },
  });

  // 환경 정보(날씨·기온·수온·물때)는 Prisma 가 모르는 raw 컬럼이라 별도로 읽어 붙인다.
  // 조회에 실패해도(컬럼 미생성 등) 기존처럼 null 로 내려가 계측일지는 정상 동작한다.
  const envById = new Map<string, Record<string, unknown>>();
  if (rows.length) {
    try {
      await ensureCatchEnvColumns();
      const cols = CATCH_ENV_COLUMNS.map((c) => `\`${c}\``).join(", ");
      const placeholders = rows.map(() => "?").join(", ");
      const envRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT \`id\`, ${cols} FROM \`CatchRecord\` WHERE \`id\` IN (${placeholders})`,
        ...rows.map((r) => r.id),
      );
      for (const e of envRows) envById.set(String(e.id), e);
    } catch { /* 환경 정보 없이 진행 */ }
  }

  const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));

  // 로컬 기록(DatabaseService)과 같은 형태로 정규화해 병합 비용을 클라이언트에서 없앤다.
  // 길이가 없는 기록은 계측일지에서 의미가 없으므로 제외한다 (통계도 오염시킨다).
  const items = rows
    .filter((r) => (r.measuredLengthCm ?? r.sizeCm) != null)
    .map((r) => {
      const env = envById.get(r.id) ?? {};
      return {
        id: `srv:${r.id}`,
        serverId: r.id,
        measuredAt: r.createdAt.toISOString(),
        lengthCm: r.measuredLengthCm ?? r.sizeCm,
        bodyWidth: r.bodyWidth ?? null,
        weightG: r.estimatedWeight ?? null,
        speciesKr: r.speciesName || "기타",
        confidence: r.confidence ?? null,
        confidenceGrade: null,
        imageUrl: r.measuredImageUrl || r.photoUrl || null,
        imageBase64: null,
        latitude: r.fishingPoint?.lat ?? null,
        longitude: r.fishingPoint?.lng ?? null,
        locationName: r.fishingPoint?.region ?? null,
        weather: str(env.weather),
        temperature: num(env.airTemp),
        tidePhase: str(env.tidePhase),
        tideName: str(env.tideName),
        waterTemp: num(env.waterTemp),
        ballId: r.ballId ?? null,
        keyringId: null,
        synced: 1,
      };
    });

  return NextResponse.json({ items });
}

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
  // 사진이 없으면 null 로 저장한다.
  // (예전엔 picsum 랜덤 이미지를 넣었는데, 남의 사진이 내 조과로 박제되어 기록이 오염됐다)
  const photo: string | null = b.photoUrl || null;

  // 좌표가 없으면 null — 임의의 기본 좌표(서울시청)를 넣으면 실제로 가지 않은 곳에
  // 어장포인트가 찍혀 지도·통계가 통째로 오염된다.
  const latRaw = b.lat != null ? Number(b.lat) : NaN;
  const lngRaw = b.lng != null ? Number(b.lng) : NaN;
  const hasCoords =
    Number.isFinite(latRaw) && Number.isFinite(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180;
  const lat: number | null = hasCoords ? latRaw : null;
  const lng: number | null = hasCoords ? lngRaw : null;

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
    // FishingPoint 는 lat/lng 가 필수 컬럼 — 좌표가 없으면 아예 만들지 않는다.
    const point =
      lat !== null && lng !== null
        ? await tx.fishingPoint.create({
            data: {
              userId: user.id, lat, lng, accuracy: b.accuracy ?? 12,
              tripId: b.tripId || null,
              speciesName: b.speciesName || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
              photoUrl: photo, gearSetup: b.gearSummary || null, region: b.region || null,
              visibility: b.pointVisibility || "EXACT",
            },
          })
        : null;

    const cr = await tx.catchRecord.create({
      data: {
        userId: user.id, fishingPointId: point?.id ?? null, speciesName: b.speciesName || "미상",
        species: weightKey || null, estimatedWeight: estimatedWeight ?? null,
        categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
        bodyWidth,
        photoUrl: photo, shareToFeed: b.shareToFeed !== false,
        originalImageUrl: b.originalImageUrl || photo || null, measuredImageUrl: b.measuredImageUrl || photo || null,
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
          authorId: user.id, postType: "FISHING_POINT", fishingPointId: point?.id ?? null,
          caption: b.caption || `${b.region || ""} ${b.speciesName || ""} ${b.sizeCm || ""}cm 🎣`,
          speciesName: b.speciesName || null, fishingType: b.fishingType || null,
          categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
          region: b.region || null, lat, lng, visibility: b.visibility || "PUBLIC",
          // 사진이 없으면 이미지 레코드를 만들지 않는다 (빈 URL 이미지 방지)
          images: photo ? { create: [{ url: photo, alt: "계측 사진", order: 0 }] } : undefined,
          productTags: buildProductTags(b),
        },
      });
      postId = feedPost.id;
    }

    return { point, cr, postId };
  });

  // 환경 정보(날씨·기온·수온·물때·풍속) — keyringId 와 같은 raw 컬럼이라 트랜잭션 뒤 raw UPDATE.
  // 값이 하나도 없으면 UPDATE 자체를 생략하고, 실패해도 기록 저장은 성공 처리한다.
  const envValues: Record<string, string | number | null> = {
    weather: typeof b.weather === "string" && b.weather.trim() ? b.weather.trim().slice(0, 64) : null,
    airTemp: numOrNull(b.airTemp ?? b.temperature),
    waterTemp: numOrNull(b.waterTemp),
    tideName: typeof b.tideName === "string" && b.tideName.trim() ? b.tideName.trim().slice(0, 32) : null,
    tidePhase: typeof b.tidePhase === "string" && b.tidePhase.trim() ? b.tidePhase.trim().slice(0, 32) : null,
    windSpeed: numOrNull(b.windSpeed),
  };
  const envSet = Object.entries(envValues).filter(([, v]) => v !== null);
  if (envSet.length) {
    try {
      await ensureCatchEnvColumns();
      await prisma.$executeRawUnsafe(
        `UPDATE \`CatchRecord\` SET ${envSet.map(([k]) => `\`${k}\` = ?`).join(", ")} WHERE \`id\` = ?`,
        ...envSet.map(([, v]) => v),
        cr.id,
      );
    } catch { /* noop — 환경 정보는 부가 정보라 저장 실패해도 기록은 유지 */ }
  }

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

  return NextResponse.json({ ok: true, pointId: point?.id ?? null, catchId: cr.id, postId, pointsEarned });
}
