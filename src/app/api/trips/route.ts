export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createWalkingFeedPost } from "@/lib/walkingFeed";

// GET: 로그인 사용자의 스마트피싱(낚시) 기록 목록
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ trips: [] }); }
  const trips = await prisma.fishingTrip.findMany({
    where: {
      userId: user.id,
      endedAt: { not: null },
      NOT: { AND: [{ distanceM: 0 }, { durationSec: 0 }, { catchCount: 0 }] },
    },
    orderBy: { startedAt: "desc" },
    take: 30,
    include: { _count: { select: { routePoints: true } } },
  });
  // 이미 워킹 피드에 공개된 기록은 postId를 함께 내려 UI가 "게시됨" 상태를 유지하게 한다.
  // (자동 생성된 비공개 글은 아직 게시된 것이 아니므로 PUBLIC만 조회)
  const publishedByTrip = new Map<string, string>();
  try {
    const posts = await prisma.post.findMany({
      where: {
        tripId: { in: trips.map((t) => t.id) },
        postType: "WALKING_FEED",
        visibility: "PUBLIC",
      },
      select: { id: true, tripId: true },
    });
    for (const p of posts) if (p.tripId) publishedByTrip.set(p.tripId, p.id);
  } catch { /* 조회 실패 시 postId 없이 반환 */ }

  const data = trips.map((t) => ({
    id: t.id,
    title: t.title,
    distanceM: t.distanceM,
    durationSec: t.durationSec,
    points: t._count.routePoints,
    catchCount: t.catchCount,
    region: t.region,
    createdAt: t.startedAt.toISOString(),
    postId: publishedByTrip.get(t.id) ?? null,
  }));
  return NextResponse.json({ trips: data });
}

// POST: 스마트피싱 기록 저장 (옵션: 피드에도 게시)
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
  const title = b.title || "스마트피싱 기록";

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

  // 워킹 피드 글 자동 생성 (실패해도 기록 저장은 성공 처리)
  try { await createWalkingFeedPost(trip.id, user.id); } catch { /* noop */ }

  return NextResponse.json({ ok: true, id: trip.id });
}
