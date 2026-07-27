import { NextResponse } from "next/server";
import { requireUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const user = await requireUser();
    // 세션 먼저 파괴 (쿠키 제거 포함)
    await destroySession();
    // 유저 삭제 (cascade로 관련 데이터 정리)
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.json({ error: "탈퇴 처리에 실패했습니다." }, { status: 500 });
  }
}
