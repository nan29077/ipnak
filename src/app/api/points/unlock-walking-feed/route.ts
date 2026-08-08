import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unlockWalkingFeed } from "@/lib/points";

export const dynamic = "force-dynamic";

// POST /api/points/unlock-walking-feed { postId } — 200P 차감 후 열람 (작성자 100P 적립)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { postId } = await req.json().catch(() => ({}));
  if (!postId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    const result = await unlockWalkingFeed(user.id, String(postId));
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "INSUFFICIENT_POINTS")
      return NextResponse.json({ error: "포인트가 부족합니다." }, { status: 400 });
    if (e.message === "NOT_WALKING_FEED")
      return NextResponse.json({ error: "워킹 피드 글이 아닙니다." }, { status: 400 });
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}
