import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  try {
    const existing = await prisma.like.findUnique({ where: { postId_userId: { postId: params.id, userId: user.id } } });
    let liked: boolean;
    if (existing) {
      // 좋아요 취소 — 동시 요청으로 이미 삭제됐으면(P2025) 그대로 취소 상태로 처리
      try {
        await prisma.like.delete({ where: { id: existing.id } });
      } catch (e: any) {
        if (e?.code !== "P2025") throw e;
      }
      liked = false;
    } else {
      // 좋아요 등록 — 동시 요청으로 이미 생성됐으면(P2002 unique 위반) 현재 상태 그대로 반환.
      // 알림은 create 가 실제로 성공한 "최초 1회"에만 발송된다 (P2002 시 중복 알림 방지).
      let created = false;
      try {
        await prisma.like.create({ data: { postId: params.id, userId: user.id } });
        created = true;
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
      }
      liked = true;
      if (created) {
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
    }
    const count = await prisma.like.count({ where: { postId: params.id } });
    return NextResponse.json({ liked, count });
  } catch {
    // 삭제된 게시글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
