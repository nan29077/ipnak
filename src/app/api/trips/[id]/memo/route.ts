export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET /api/trips/[id]/memo
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ memo: null }); }
  try {
    const trip = await prisma.fishingTrip.findFirst({
      where: { id: params.id, userId: user.id },
      select: { memo: true },
    });
    return NextResponse.json({ memo: trip?.memo ?? null });
  } catch {
    // memo 컬럼이 DB에 없을 경우 (db push 전)
    return NextResponse.json({ memo: null });
  }
}

// PATCH /api/trips/[id]/memo  { memo: string }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const memo = typeof body?.memo === "string" ? body.memo.slice(0, 100) : "";

  const trip = await prisma.fishingTrip.findFirst({ where: { id: params.id, userId: user.id } });
  if (!trip) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  try {
    await prisma.fishingTrip.update({ where: { id: params.id }, data: { memo } });
  } catch {
    return NextResponse.json({ error: "db push가 필요합니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, memo });
}
