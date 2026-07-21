/**
 * 입낚볼 연동 API
 * - GET  /api/balls : 현재 사용자의 연동된 입낚볼 목록
 * - POST /api/balls : NFC 로 읽은 볼 ID 를 현재 계정에 등록 { ballId: string }
 *
 * 주의: LinkedBall 모델은 아직 prisma generate 가 반영되지 않아
 * prisma.$queryRaw / $executeRaw (raw SQL) 로만 접근한다. (prisma db push 필요)
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type BallRow = {
  id: string;
  ballId: string;
  linkedAt: Date | string;
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const balls = await prisma.$queryRaw<BallRow[]>`
      SELECT id, ballId, linkedAt
      FROM LinkedBall
      WHERE userId = ${user.id}
      ORDER BY linkedAt DESC
    `;
    return NextResponse.json({ balls });
  } catch {
    return NextResponse.json({ error: "볼 목록을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const ballId = typeof body?.ballId === "string" ? body.ballId.trim() : "";
    if (!ballId) {
      return NextResponse.json({ error: "ballId 가 필요합니다." }, { status: 400 });
    }

    // 이미 등록된 볼이면 그대로 반환 (userId+ballId 유니크)
    const existing = await prisma.$queryRaw<BallRow[]>`
      SELECT id, ballId, linkedAt FROM LinkedBall
      WHERE userId = ${user.id} AND ballId = ${ballId}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ ball: existing[0], alreadyLinked: true });
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO LinkedBall (id, userId, ballId)
      VALUES (${id}, ${user.id}, ${ballId})
    `;
    const created = await prisma.$queryRaw<BallRow[]>`
      SELECT id, ballId, linkedAt FROM LinkedBall WHERE id = ${id} LIMIT 1
    `;
    return NextResponse.json({ ball: created[0] ?? { id, ballId }, alreadyLinked: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "볼 등록에 실패했어요." }, { status: 500 });
  }
}
