/**
 * 입낚볼 연동 API
 * - GET    /api/balls : 현재 사용자의 연동된 입낚볼 목록
 * - POST   /api/balls : 볼 ID 를 현재 계정에 등록 { ballId: string }
 * - DELETE /api/balls : 볼 연동 해제 { id: string }
 *   (NFC 자동 읽기 또는 수동 입력 모두 동일 엔드포인트 사용)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

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

    // IP당 분당 10회 제한 (볼 등록은 자주 할 이유 없음)
    const ip = getClientIp(req);
    if (!rateLimit(`ball-register:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const ballId = typeof body?.ballId === "string" ? body.ballId.trim().toUpperCase() : "";
    if (!ballId) {
      return NextResponse.json({ error: "ballId 가 필요합니다." }, { status: 400 });
    }

    // ── 화이트리스트 검증: IpnakBallRegistry에 등록되고 isActive=true인 ID만 허용 ──
    const registryRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakBallRegistry WHERE ballId = ? AND isActive = 1`,
      ballId
    );
    if (Number(registryRows[0]?.cnt ?? 0) === 0) {
      return NextResponse.json(
        { error: "유효하지 않은 볼 ID입니다. 관리자에게 문의해 주세요." },
        { status: 400 }
      );
    }

    // ── 글로벌 유니크 검증: 같은 볼 ID가 다른 계정에 이미 연동돼 있으면 거부 ──
    // 연동 해제 후에는 다른 계정에서 등록 가능 (소유권 이전 지원)
    const takenByOther = await prisma.linkedBall.findFirst({
      where: { ballId, NOT: { userId: user.id } },
      select: { id: true },
    });
    if (takenByOther) {
      return NextResponse.json(
        { error: "이 볼 ID는 다른 계정에 이미 연동되어 있어요. 기존 계정에서 연동 해제 후 다시 시도해 주세요." },
        { status: 409 }
      );
    }

    // 이미 내 계정에 등록된 볼이면 그대로 반환
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

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    // 본인 소유 확인 후 삭제
    const deleted = await prisma.linkedBall.deleteMany({
      where: { id, userId: user.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "볼을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "연동 해제에 실패했어요." }, { status: 500 });
  }
}
