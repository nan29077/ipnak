export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET: 단일 스마트피싱 기록 상세 (경로·거리·시간·피쉬 기록)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  const trip = await prisma.fishingTrip.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      routePoints: { orderBy: { order: "asc" } },
      fishingPoints: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  const walkingFeedPost = await prisma.post.findFirst({
    where: { tripId: params.id, postType: "WALKING_FEED" },
    select: { id: true, visibility: true },
  });

  // tripId로 직접 연결된 피쉬 기록
  let fishPoints = trip.fishingPoints;

  // tripId 연결이 없는 경우: 세션 시간 범위 ±30분 내 유저 catch 조회로 보완
  if (fishPoints.length === 0 && trip.startedAt) {
    const baseEnd = trip.endedAt
      ?? new Date(trip.startedAt.getTime() + Math.max(trip.durationSec, 0) * 1000);
    // 종료 시각으로부터 30분 후까지 잡은 물고기도 포함 (기록 종료 직후 제출 케이스 대응)
    const sessionEnd = new Date(baseEnd.getTime() + 30 * 60 * 1000);
    // 시작 2분 전부터 탐색 (앱 시작 직후 바로 기록하는 케이스)
    const sessionStart = new Date(trip.startedAt.getTime() - 2 * 60 * 1000);
    try {
      fishPoints = await prisma.fishingPoint.findMany({
        where: {
          userId: user.id,
          tripId: null,
          createdAt: { gte: sessionStart, lte: sessionEnd },
        },
        orderBy: { createdAt: "asc" },
      });
    } catch { /* 폴백 실패 시 빈 배열 유지 */ }
  }

  const mapPoint = (f: typeof fishPoints[number]) => ({
    id: f.id,
    speciesName: f.speciesName,
    sizeCm: f.sizeCm,
    photoUrl: f.photoUrl,
    region: f.region,
    gearSetup: f.gearSetup,
    createdAt: f.createdAt.toISOString(),
    lat: f.lat,
    lng: f.lng,
  });

  return NextResponse.json({
    trip: {
      id: trip.id,
      title: trip.title,
      distanceM: trip.distanceM,
      durationSec: trip.durationSec,
      region: trip.region,
      catchCount: Math.max(trip.catchCount, fishPoints.length),
      startedAt: trip.startedAt.toISOString(),
      endedAt: trip.endedAt?.toISOString() ?? null,
      createdAt: trip.startedAt.toISOString(),
      routePoints: trip.routePoints.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })),
      catches: fishPoints.map(mapPoint),
      walkingFeedPostId: walkingFeedPost?.id ?? null,
      walkingFeedPublished: walkingFeedPost?.visibility === "PUBLIC",
    },
  });
}

// DELETE: 스마트피싱 기록 삭제
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  const trip = await prisma.fishingTrip.findFirst({ where: { id: params.id, userId: user.id } });
  if (!trip) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  // 워킹피드 글: 다른 사용자가 열람하지 않은 경우에만 삭제, 열람한 경우 tripId만 해제(글은 보존)
  try {
    const walkingPost = await prisma.post.findFirst({
      where: { tripId: params.id, postType: "WALKING_FEED" },
      select: { id: true },
    });
    if (walkingPost) {
      const otherUnlockCount = await prisma.walkingFeedUnlock.count({
        where: { postId: walkingPost.id, userId: { not: trip.userId } },
      });
      if (otherUnlockCount === 0) {
        await prisma.post.delete({ where: { id: walkingPost.id } });
      } else {
        // 열람자가 있으면 글은 유지하되 tripId 연결만 해제
        await prisma.post.update({ where: { id: walkingPost.id }, data: { tripId: null } });
      }
    }
  } catch { /* 워킹 피드 글 처리 실패는 기록 삭제를 막지 않는다 */ }

  await prisma.fishingTrip.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
