export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET: 단일 데이터피싱 기록 상세 (경로·거리·시간·피쉬 기록)
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

  // tripId로 직접 연결된 피쉬 기록
  let fishPoints = trip.fishingPoints;

  // tripId 연결이 없는 경우(기존 데이터 호환): 세션 시간 범위 내 유저 catch 조회로 보완
  if (fishPoints.length === 0 && trip.startedAt && (trip.endedAt || trip.durationSec > 0)) {
    const sessionEnd = trip.endedAt ?? new Date(trip.startedAt.getTime() + trip.durationSec * 1000 + 60000);
    try {
      fishPoints = await prisma.fishingPoint.findMany({
        where: {
          userId: user.id,
          tripId: null,
          createdAt: { gte: trip.startedAt, lte: sessionEnd },
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
      catchCount: trip.catchCount,
      startedAt: trip.startedAt.toISOString(),
      endedAt: trip.endedAt?.toISOString() ?? null,
      createdAt: trip.startedAt.toISOString(),
      routePoints: trip.routePoints.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })),
      catches: fishPoints.map(mapPoint),
    },
  });
}
