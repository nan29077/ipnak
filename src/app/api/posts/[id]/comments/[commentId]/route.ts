import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 댓글 삭제 — 작성자 본인만
export async function DELETE(
  _: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: { id: true, authorId: true, postId: true },
  });
  if (!comment || comment.postId !== params.id) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (comment.authorId !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    await prisma.comment.delete({ where: { id: params.commentId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "댓글 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
