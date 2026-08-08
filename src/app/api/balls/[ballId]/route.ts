/**
 * 입낚볼 개별 볼 API
 * - DELETE /api/balls/[ballId] : 연동된 볼 해제 (본인 소유만 가능)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { ballId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const ballId = decodeURIComponent(params.ballId || "").trim();
    if (!ballId) {
      return NextResponse.json({ error: "ballId 가 필요합니다." }, { status: 400 });
    }

    // 해당 사용자가 소유한 볼만 삭제
    const deleted = await prisma.linkedBall.deleteMany({
      where: { userId: user.id, ballId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "볼을 찾을 수 없어요." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "볼 삭제에 실패했어요." }, { status: 500 });
  }
}
