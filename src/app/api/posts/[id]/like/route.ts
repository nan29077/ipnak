import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  try {
    const existing = await prisma.like.findUnique({ where: { postId_userId: { postId: params.id, userId: user.id } } });
    if (existing) await prisma.like.delete({ where: { id: existing.id } });
    else {
      await prisma.like.create({ data: { postId: params.id, userId: user.id } });
      // 좋아요를 새로 누른 경우에만 게시글 작성자에게 알림 (본인 제외)
      try {
        const post = await prisma.post.findUnique({ where: { id: params.id }, select: { authorId: true } });
        if (post && post.authorId !== user.id) {
          await prisma.notification.create({
            data: {
              userId: post.authorId,
              type: "LIKE",
              body: `${user.nickname}님이 좋아요를 눌렀습니다`,
              link: `/post/${params.id}`,
              actorId: user.id,
              postId: params.id,
            },
          });
        }
      } catch { /* 알림 실패는 무시 */ }
    }
    const count = await prisma.like.count({ where: { postId: params.id } });
    return NextResponse.json({ liked: !existing, count });
  } catch {
    // 삭제된 게시글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
