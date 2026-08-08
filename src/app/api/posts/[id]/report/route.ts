import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const { reason } = await req.json().catch(() => ({}));
  try {
    await prisma.report.create({ data: { reporterId: user.id, postId: params.id, targetType: "POST", reason: reason || "신고" } });
    return NextResponse.json({ ok: true });
  } catch {
    // 삭제된 게시글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
