export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureFishingSpotEnvColumns, pickSpotEnv } from "@/lib/ensureFishingSpotEnvColumns";

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

  // 위치 표기·날씨·기온·수온·바람·물때 — raw 컬럼이라 Prisma update 와 분리해 처리한다.
  // 본문에 실제로 들어온 키만 갱신한다 (부분 수정 규칙을 그대로 따른다).
  const env = pickSpotEnv(b as Record<string, unknown>, { partial: true });
  const envEntries = Object.entries(env);

  if (Object.keys(data).length === 0 && envEntries.length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  try {
    // 일반 필드가 하나도 없으면 Prisma update 는 건너뛰고 현재 값만 읽어 온다
    const spot = Object.keys(data).length
      ? await prisma.fishingSpot.update({ where: { id: params.id }, data })
      : await prisma.fishingSpot.findUniqueOrThrow({ where: { id: params.id } });

    if (envEntries.length) {
      try {
        await ensureFishingSpotEnvColumns();
        await prisma.$executeRawUnsafe(
          `UPDATE \`FishingSpot\` SET ${envEntries.map(([k]) => `\`${k}\` = ?`).join(", ")} WHERE \`id\` = ?`,
          ...envEntries.map(([, v]) => v),
          params.id,
        );
      } catch { /* noop — 부가 정보 저장 실패해도 수정 자체는 성공 처리 */ }
    }

    return NextResponse.json({
      ok: true,
      spot: {
        ...spot,
        ...env,
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
