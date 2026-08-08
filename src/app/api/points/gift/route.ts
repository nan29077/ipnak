import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { giftPoints, pointsEnabled } from "@/lib/points";

export const dynamic = "force-dynamic";

// POST /api/points/gift { to, amount } — 친구(닉네임/이메일)에게 포인트 선물
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await pointsEnabled())) return NextResponse.json({ error: "포인트 기능이 비활성화되어 있습니다." }, { status: 400 });

  const { to, amount } = await req.json().catch(() => ({}));
  try {
    const result = await giftPoints(user.id, String(to || ""), Number(amount));
    return NextResponse.json(result);
  } catch (e: any) {
    const map: Record<string, string> = {
      INVALID_AMOUNT: "선물할 포인트를 정확히 입력해주세요.",
      USER_NOT_FOUND: "해당 아이디(닉네임/이메일)의 회원을 찾을 수 없습니다.",
      SELF_GIFT: "자기 자신에게는 선물할 수 없습니다.",
      INSUFFICIENT_POINTS: "포인트가 부족합니다.",
    };
    return NextResponse.json({ error: map[e.message] || "처리에 실패했습니다." }, { status: 400 });
  }
}
