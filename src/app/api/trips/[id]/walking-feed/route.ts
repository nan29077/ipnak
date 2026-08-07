export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/**
 * DELETE /api/trips/[id]/walking-feed
 * 스마트피싱 기록에 연결된 워킹피드 게시글을 삭제한다.
 *
 * 보호 조건: 작성자 본인 이외의 사용자가 한 번이라도 포인트로 열람했으면 삭제 불가.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); }
  catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  // 기록 소유자 확인
  const trip = await prisma.fishingTrip.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!trip) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  // 연결된 워킹피드 글 조회
  const post = await prisma.post.findFirst({
    where: { tripId: params.id, postType: "WALKING_FEED" },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "게시된 워킹피드가 없습니다." }, { status: 404 });
  }

  // 다른 사용자 열람 여부 확인 (본인 제외)
  const otherUnlockCount = await prisma.walkingFeedUnlock.count({
    where: { postId: post.id, userId: { not: user.id } },
  });
  if (otherUnlockCount > 0) {
    return NextResponse.json(
      { error: "다른 사용자가 이미 열람한 워킹피드는 삭제할 수 없습니다." },
      { status: 403 }
    );
  }

  await prisma.post.delete({ where: { id: post.id } });
  return NextResponse.json({ ok: true });
}
