import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 피드 글 수정 — 작성자 본인만
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.caption === "string") data.caption = b.caption;
  if (typeof b.body === "string") data.body = b.body;
  if (typeof b.title === "string") data.title = b.title;
  if (typeof b.region === "string") data.region = b.region;
  if (Array.isArray(b.hashtags)) data.hashtags = JSON.stringify(b.hashtags);

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });
  try {
    await prisma.post.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "게시글 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// 피드 글 삭제 — 작성자 본인만
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  try {
    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "게시글 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
