export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET: 로그인 사용자의 데이터피싱(낚시) 기록 목록
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ trips: [] }); }
  const trips = await prisma.fishingTrip.findMany({
    where: { userId: user.id, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 30,
    include: { _count: { select: { routePoints: true } } },
  });
  const data = trips.map((t) => ({
    id: t.id,
    title: t.title,
    distanceM: t.distanceM,
    durationSec: t.durationSec,
    points: t._count.routePoints,
    catchCount: t.catchCount,
    region: t.region,
    createdAt: t.startedAt.toISOString(),
  }));
  return NextResponse.json({ trips: data });
}

// POST: 데이터피싱 기록 저장 (옵션: 피드에도 게시)
export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));

  const rawPoints: Array<{ lat: number; lng: number; order?: number }> = Array.isArray(b.points) ? b.points : [];
  const points = rawPoints
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    .map((p, i) => ({ lat: Number(p.lat), lng: Number(p.lng), order: p.order ?? i }));

  const distanceM = Number.isFinite(b.distanceM) ? Number(b.distanceM) : 0;
  const durationSec = Number.isFinite(b.durationSec) ? Math.round(Number(b.durationSec)) : 0;
  const region = b.region || null;
  const title = b.title || "데이터피싱 기록";

  const trip = await prisma.fishingTrip.create({
    data: {
      userId: user.id,
      title,
      distanceM,
      durationSec,
      catchCount: Number.isFinite(b.catchCount) ? Number(b.catchCount) : points.length,
      region,
      endedAt: new Date(),
      routePoints: points.length ? { create: points.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })) } : undefined,
    },
  });

  return NextResponse.json({ ok: true, id: trip.id });
}
