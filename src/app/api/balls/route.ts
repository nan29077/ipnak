/**
 * 입낚볼 연동 API
 * - GET  /api/balls : 현재 사용자의 연동된 입낚볼 목록
 * - POST /api/balls : 볼 ID 를 현재 계정에 등록 { ballId: string }
 *   (NFC 자동 읽기 또는 수동 입력 모두 동일 엔드포인트 사용)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const balls = await prisma.linkedBall.findMany({
      where: { userId: user.id },
      orderBy: { linkedAt: "desc" },
      select: { id: true, ballId: true, linkedAt: true },
    });
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

    // 이미 등록된 볼이면 그대로 반환
    const existing = await prisma.linkedBall.findUnique({
      where: { userId_ballId: { userId: user.id, ballId } },
    });
    if (existing) {
      return NextResponse.json({ ball: existing, alreadyLinked: true });
    }

    const ball = await prisma.linkedBall.create({
      data: { userId: user.id, ballId },
      select: { id: true, ballId: true, linkedAt: true },
    });
    return NextResponse.json({ ball, alreadyLinked: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "볼 등록에 실패했어요." }, { status: 500 });
  }
}
