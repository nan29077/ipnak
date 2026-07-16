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

  return NextResponse.json({
    trip: {
      id: trip.id,
      title: trip.title,
      distanceM: trip.distanceM,
      durationSec: trip.durationSec,
      region: trip.region,
      createdAt: trip.startedAt.toISOString(),
      routePoints: trip.routePoints.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })),
      catches: trip.fishingPoints.map((f) => ({
        id: f.id,
        speciesName: f.speciesName,
        sizeCm: f.sizeCm,
        photoUrl: f.photoUrl,
        region: f.region,
        gearSetup: f.gearSetup,
        createdAt: f.createdAt.toISOString(),
      })),
    },
  });
}
