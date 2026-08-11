export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ensureFishingSpotEnvColumns,
  pickSpotEnv,
  SPOT_ENV_COLUMNS,
} from "@/lib/ensureFishingSpotEnvColumns";

/** 저장 가능한 sourceType */
const SOURCE_TYPES = ["ai", "trip", "manual"] as const;

/** 문자열 필드 정리 — 공백만 있으면 null */
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

// GET: 내 어장포인트 목록 (로그인 필수, 본인 것만)
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const spots = await prisma.fishingSpot.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // 위치·환경 정보는 Prisma 가 모르는 raw 컬럼이라 별도로 읽어 붙인다.
    // 조회에 실패해도(컬럼 미생성 등) 기존 필드만으로 화면은 정상 동작한다.
    const envById = new Map<string, Record<string, unknown>>();
    if (spots.length) {
      try {
        await ensureFishingSpotEnvColumns();
        const cols = SPOT_ENV_COLUMNS.map((c) => `\`${c}\``).join(", ");
        const placeholders = spots.map(() => "?").join(", ");
        const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT \`id\`, ${cols} FROM \`FishingSpot\` WHERE \`id\` IN (${placeholders})`,
          ...spots.map((s) => s.id),
        );
        for (const r of rows) envById.set(String(r.id), r);
      } catch { /* 환경 정보 없이 진행 */ }
    }

    return NextResponse.json({
      spots: spots.map((s) => {
        const { id: _omit, ...env } = envById.get(s.id) ?? {};
        return {
          ...s,
          ...env,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        };
      }),
    });
  } catch {
    // FishingSpot 테이블이 아직 없는 환경(db push 전)에서도 화면이 깨지지 않게 한다
    return NextResponse.json({ spots: [] });
  }
}

// POST: 새 어장포인트 추가
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>));

  const name = str(b.name, 60);
  if (!name) return NextResponse.json({ error: "스팟 이름을 입력해 주세요." }, { status: 400 });

  const lat = num(b.lat);
  const lng = num(b.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "좌표가 올바르지 않습니다." }, { status: 400 });
  }

  const rawSource = str(b.sourceType, 10);
  const sourceType = (SOURCE_TYPES as readonly string[]).includes(rawSource ?? "")
    ? rawSource
    : "manual";

  try {
    const spot = await prisma.fishingSpot.create({
      data: {
        userId: user.id,
        name,
        lat,
        lng,
        depth: num(b.depth),
        species: str(b.species, 200),
        season: str(b.season, 100),
        memo: str(b.memo, 1000),
        photoUrl: str(b.photoUrl, 100000),
        sourceType,
        sourceTripId: str(b.sourceTripId, 60),
        sourceCatchId: str(b.sourceCatchId, 60),
      },
    });

    // 위치 표기·날씨·기온·수온·바람·물때 — raw 컬럼이라 생성 뒤 별도 UPDATE 로 기록한다.
    // 값이 하나도 없으면 UPDATE 를 생략하고, 실패해도 어장포인트 저장은 성공 처리한다.
    const env = pickSpotEnv(b as Record<string, unknown>);
    const envSet = Object.entries(env).filter(([, v]) => v !== null);
    if (envSet.length) {
      try {
        await ensureFishingSpotEnvColumns();
        await prisma.$executeRawUnsafe(
          `UPDATE \`FishingSpot\` SET ${envSet.map(([k]) => `\`${k}\` = ?`).join(", ")} WHERE \`id\` = ?`,
          ...envSet.map(([, v]) => v),
          spot.id,
        );
      } catch { /* noop — 부가 정보라 저장 실패해도 포인트는 유지 */ }
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
  } catch (e) {
    console.error("[fishing-spots POST] DB 저장 실패:", e);
    // FishingSpot 테이블이 없는 경우 prisma db push 가 필요합니다.
    return NextResponse.json({ error: "어장포인트 저장에 실패했습니다. 서버 로그를 확인해 주세요." }, { status: 500 });
  }
}
