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
  const comment = await prisma.comment.create({
    data: { postId: params.id, authorId: user.id, body: String(body).trim(), parentId: parentId || null },
    include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
  });
  return NextResponse.json({ comment });
}
