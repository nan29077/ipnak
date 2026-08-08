import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBalance, pointsEnabled } from "@/lib/points";

export const dynamic = "force-dynamic";

// GET /api/points/balance — 현재 회원 보유 포인트
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const [balance, enabled] = await Promise.all([getBalance(user.id), pointsEnabled()]);
  return NextResponse.json({ balance, enabled });
}
