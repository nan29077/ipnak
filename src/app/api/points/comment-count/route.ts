import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { commentRewardStatus, POINT_RULES } from "@/lib/points";

export const dynamic = "force-dynamic";

// GET /api/points/comment-count — 오늘(KST) 댓글 적립 현황
// { enabled, used, limit, reward } — used 는 오늘 적립받은 댓글 수(일반 댓글·낚시단 댓글 합산)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      enabled: false,
      used: 0,
      limit: POINT_RULES.COMMENT_DAILY_LIMIT,
      reward: POINT_RULES.COMMENT_REWARD,
    });
  }
  return NextResponse.json(await commentRewardStatus(user.id));
}
