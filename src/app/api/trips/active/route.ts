export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// 진행 중(중지 전) 데이터피싱 세션 = endedAt 이 null 인 FishingTrip 레코드.
// 별도 스키마 변경 없이 "전역으로 유지되는 기록 세션"을 서버에 영속화한다.

function activeSummary(t: { id: string; startedAt: Date; distanceM: number; durationSec: number; catchCount: number }) {
  return {
    id: t.id,
    startedAt: t.startedAt.toISOString(),
    distanceM: t.distanceM,
    durationSec: t.durationSec,
    points: t.catchCount,
  };
}

// GET: 현재 진행 중인 세션 조회 (없으면 active: null)
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ active: null }); }
  const t = await prisma.fishingTrip.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ active: t ? activeSummary(t) : null });
}

// POST: 기록 시작 — 진행 중 세션 생성(이미 있으면 재사용). 서버 startedAt 기준으로 경과시간 산정.
export async function POST() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const existing = await prisma.fishingTrip.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return NextResponse.json({ active: activeSummary(existing) });
  const t = await prisma.fishingTrip.create({
    data: { userId: user.id, title: "데이터피싱 기록", endedAt: null },
  });
  return NextResponse.json({ active: activeSummary(t) });
}

// PATCH: 진행 중 세션 통계 하트비트(이동거리/경과시간/포인트 수)를 서버에 주기적으로 반영.
export async function PATCH(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const where = b.id
    ? { id: String(b.id), userId: user.id, endedAt: null }
    : { userId: user.id, endedAt: null };
  const target = await prisma.fishingTrip.findFirst({ where });
  if (!target) return NextResponse.json({ active: null });
  const t = await prisma.fishingTrip.update({
    where: { id: target.id },
    data: {
      distanceM: Number.isFinite(b.distanceM) ? Number(b.distanceM) : target.distanceM,
      durationSec: Number.isFinite(b.durationSec) ? Math.round(Number(b.durationSec)) : target.durationSec,
      catchCount: Number.isFinite(b.points) ? Number(b.points) : target.catchCount,
    },
  });
  return NextResponse.json({ active: activeSummary(t) });
}

// DELETE: 데이터 없는 진행 중 세션 폐기.
export async function DELETE(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ ok: false }); }
  const b = await req.json().catch(() => ({}));
  const where = b.id
    ? { id: String(b.id), userId: user.id, endedAt: null }
    : { userId: user.id, endedAt: null };
  const target = await prisma.fishingTrip.findFirst({ where });
  if (target) await prisma.fishingTrip.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}

// PUT: 중지 — 진행 중 세션을 최종 통계/경로로 마감(endedAt 설정).
export async function PUT(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));

  const rawPoints: Array<{ lat: number; lng: number; order?: number }> = Array.isArray(b.points) ? b.points : [];
  const points = rawPoints
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    .map((p, i) => ({ lat: Number(p.lat), lng: Number(p.lng), order: p.order ?? i }));

  const distanceM = Number.isFinite(b.distanceM) ? Number(b.distanceM) : 0;
  const durationSec = Number.isFinite(b.durationSec) ? Math.round(Number(b.durationSec)) : 0;

  const where = b.id
    ? { id: String(b.id), userId: user.id, endedAt: null }
    : { userId: user.id, endedAt: null };
  const target = await prisma.fishingTrip.findFirst({ where });

  // 진행 중 세션이 없으면(서버 기록 유실 등) 새로 생성해 마감한다.
  if (!target) {
    const trip = await prisma.fishingTrip.create({
      data: {
        userId: user.id,
        title: b.title || "데이터피싱 기록",
        distanceM,
        durationSec,
        catchCount: points.length,
        endedAt: new Date(),
        routePoints: points.length ? { create: points.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })) } : undefined,
      },
    });
    return NextResponse.json({ ok: true, id: trip.id });
  }

  const trip = await prisma.fishingTrip.update({
    where: { id: target.id },
    data: {
      distanceM,
      durationSec,
      catchCount: points.length,
      endedAt: new Date(),
      routePoints: points.length ? { create: points.map((p) => ({ lat: p.lat, lng: p.lng, order: p.order })) } : undefined,
    },
  });
  return NextResponse.json({ ok: true, id: trip.id });
}
