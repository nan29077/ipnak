export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isApproved(role: string | null | undefined) {
  return role === "leader" || role === "sub_leader" || role === "member";
}

// 내시단에 공유된 데이터피싱은 단장을 포함한 승인 단원 모두 200P 차감 없이 열람한다.
export async function GET(
  _req: Request,
  { params }: { params: { id: string; pointId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.id } },
    select: { role: true },
  });
  if (!isApproved(membership?.role)) {
    return NextResponse.json({ error: "해당 내시단 단원만 무료로 열람할 수 있습니다." }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<{ tripId: string | null }[]>`
    SELECT tripId FROM GroupPoint
    WHERE id = ${params.pointId} AND groupId = ${params.id}
    LIMIT 1
  `;
  const tripId = rows[0]?.tripId;
  if (!tripId) return NextResponse.json({ error: "연결된 데이터피싱 기록이 없습니다." }, { status: 404 });

  const trip = await prisma.fishingTrip.findUnique({
    where: { id: tripId },
    include: {
      routePoints: { orderBy: { order: "asc" } },
      fishingPoints: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) return NextResponse.json({ error: "데이터피싱 기록을 찾을 수 없습니다." }, { status: 404 });

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
      catches: trip.fishingPoints.map((f) => ({
        id: f.id,
        speciesName: f.speciesName,
        sizeCm: f.sizeCm,
        photoUrl: f.photoUrl,
        region: f.region,
        gearSetup: f.gearSetup,
        createdAt: f.createdAt.toISOString(),
        lat: f.lat,
        lng: f.lng,
      })),
    },
    freeForGroupMember: true,
  });
}
