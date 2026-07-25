export const dynamic = "force-dynamic"; // 프로덕션 빌드 시 정적 캐싱 방지 — 항상 최신 댓글 반환
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { postId: params.id, hidden: false },
    include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const { body, parentId } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "내용을 입력하세요." }, { status: 400 });
  try {
    const comment = await prisma.comment.create({
      data: { postId: params.id, authorId: user.id, body: String(body).trim(), parentId: parentId || null },
      include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
    });
    return NextResponse.json({ comment });
  } catch {
    // 삭제된 게시글/부모 댓글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
