export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/** 문자열 필드 정리 — 빈 문자열은 null(값 지움)로 본다 */
function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

/** 숫자 필드 정리 — 유한수가 아니면 null */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// PATCH: 어장포인트 수정 (본인 것만)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>));

  let existing;
  try {
    existing = await prisma.fishingSpot.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
  } catch {
    return NextResponse.json({ error: "어장포인트 수정에 실패했습니다." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "어장포인트를 찾을 수 없습니다." }, { status: 404 });
  }

  // 전달된 키만 갱신한다 (부분 수정)
  const data: Record<string, unknown> = {};

  if ("name" in b) {
    const name = str(b.name, 60);
    if (!name) return NextResponse.json({ error: "스팟 이름을 입력해 주세요." }, { status: 400 });
    data.name = name;
  }
  if ("lat" in b || "lng" in b) {
    const lat = num(b.lat);
    const lng = num(b.lng);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "좌표가 올바르지 않습니다." }, { status: 400 });
    }
    data.lat = lat;
    data.lng = lng;
  }
  if ("depth" in b) data.depth = num(b.depth);
  if ("species" in b) data.species = str(b.species, 200);
  if ("season" in b) data.season = str(b.season, 100);
  if ("memo" in b) data.memo = str(b.memo, 1000);
  if ("photoUrl" in b) data.photoUrl = str(b.photoUrl, 100000);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  try {
    const spot = await prisma.fishingSpot.update({ where: { id: params.id }, data });
    return NextResponse.json({
      ok: true,
      spot: {
        ...spot,
        createdAt: spot.createdAt.toISOString(),
        updatedAt: spot.updatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "어장포인트 수정에 실패했습니다." }, { status: 500 });
  }
}

// DELETE: 어장포인트 삭제 (본인 것만)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const existing = await prisma.fishingSpot.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "어장포인트를 찾을 수 없습니다." }, { status: 404 });
    }
    await prisma.fishingSpot.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "어장포인트 삭제에 실패했습니다." }, { status: 500 });
  }
}
