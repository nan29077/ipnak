export const dynamic = "force-dynamic"; // 프로덕션 빌드 시 정적 캐싱 방지 — 항상 최신 댓글 반환
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { excludeVirtualWhere } from "@/lib/virtualVisibility";

/** 게시글 가시성 검증 (visibility / hidden). 볼 수 없으면 false 반환 */
async function canViewPost(postId: string, userId?: string): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, visibility: true, hidden: true },
  });
  if (!post) return false;
  const p = post as any;
  if (p.hidden && p.authorId !== userId) return false;
  if (p.visibility === "PRIVATE" && p.authorId !== userId) return false;
  if (p.visibility === "FOLLOWERS" && p.authorId !== userId) {
    if (!userId) return false;
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: p.authorId } },
    });
    if (!follow) return false;
  }
  return true;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser().catch(() => null);
  // 게시글 가시성 검증 — 볼 수 없는 글의 댓글도 숨긴다
  if (!(await canViewPost(params.id, user?.id))) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  const comments = await prisma.comment.findMany({
    // 가상회원 글로벌 스위치 OFF → 가상회원이 남긴 댓글은 숨긴다.
    where: { postId: params.id, hidden: false, ...(await excludeVirtualWhere("author")) },
    include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  // 게시글 가시성 검증 — 볼 수 없는 글에는 댓글도 달 수 없다
  if (!(await canViewPost(params.id, user.id))) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  const { body, parentId } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "내용을 입력하세요." }, { status: 400 });
  try {
    const comment = await prisma.comment.create({
      data: { postId: params.id, authorId: user.id, body: String(body).trim(), parentId: parentId || null },
      include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
    });

    // 알림 생성 — 실패해도 댓글 등록 자체는 성공 처리
    try {
      const link = `/post/${params.id}`;
      const targets: { userId: string; type: string; body: string }[] = [];

      // 게시글 작성자에게 댓글 알림 (본인 제외)
      const post = await prisma.post.findUnique({ where: { id: params.id }, select: { authorId: true } });
      if (post && post.authorId !== user.id) {
        targets.push({ userId: post.authorId, type: "COMMENT", body: `${user.nickname}님이 댓글을 남겼습니다` });
      }

      // 대댓글이면 부모 댓글 작성자에게도 알림 (본인/중복 제외)
      if (parentId) {
        const parent = await prisma.comment.findUnique({ where: { id: String(parentId) }, select: { authorId: true } });
        if (parent && parent.authorId !== user.id && !targets.some((t) => t.userId === parent.authorId)) {
          targets.push({ userId: parent.authorId, type: "REPLY", body: `${user.nickname}님이 답글을 남겼습니다` });
        }
      }

      if (targets.length) {
        await prisma.notification.createMany({
          data: targets.map((t) => ({ ...t, link, actorId: user.id, postId: params.id })),
        });
      }
    } catch { /* 알림 실패는 무시 */ }

    return NextResponse.json({ comment });
  } catch {
    // 삭제된 게시글/부모 댓글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
