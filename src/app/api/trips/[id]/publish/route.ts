export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createWalkingFeedPost } from "@/lib/walkingFeed";
import { awardPostReward } from "@/lib/points";

// POST: 기록 종료 시 자동 생성된(비공개) 워킹 피드 글을 공개로 전환한다.
// 새 글을 만들지 않으므로 중복 게시가 발생하지 않는다.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  const trip = await prisma.fishingTrip.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!trip) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  // 자동 생성이 누락된 기록(기능 적용 전에 저장된 기록 등)은 이 시점에 만들어 준다.
  let post = await prisma.post.findFirst({
    where: { tripId: params.id, postType: "WALKING_FEED" },
    select: { id: true, visibility: true },
  });
  if (!post) {
    const created = await createWalkingFeedPost(params.id, user.id);
    if (!created) return NextResponse.json({ error: "게시할 기록 내용이 없습니다." }, { status: 400 });
    post = { id: created.id, visibility: created.visibility };
  }

  // 워킹 피드도 다른 피드 글과 동일하게 작성 적립 대상이다(하루 5회 한도는 종류 무관 합산).
  // 이미 공개된 글을 다시 publish 해도 중복 적립되지 않도록, 비공개 → 공개로 전환될 때만 적립한다.
  let pointsEarned = 0;
  if (post.visibility !== "PUBLIC") {
    await prisma.post.update({ where: { id: post.id }, data: { visibility: "PUBLIC" } });
    pointsEarned = (await awardPostReward(user.id, post.id)) ?? 0;
  }

  return NextResponse.json({ ok: true, id: post.id, pointsEarned });
}
