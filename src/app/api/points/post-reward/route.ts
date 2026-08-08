import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { postRewardStatus, POINT_RULES } from "@/lib/points";

export const dynamic = "force-dynamic";

// GET /api/points/post-reward — 글쓰기 화면 안내 문구용
// { enabled, used, limit, reward } — used 는 오늘(KST) 이미 적립받은 글 작성 횟수(종류 무관 합산)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      enabled: false,
      used: 0,
      limit: POINT_RULES.POST_DAILY_LIMIT,
      reward: POINT_RULES.POST_REWARD,
    });
  }
  return NextResponse.json(await postRewardStatus(user.id));
}
