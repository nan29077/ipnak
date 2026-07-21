import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { chargePoints, pointsEnabled } from "@/lib/points";

export const dynamic = "force-dynamic";

// POST /api/points/charge { amount } — 포인트 충전
// 실제 신용카드/PG 결제 연동은 추후. 현재는 mock 승인으로 즉시 충전한다.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await pointsEnabled())) return NextResponse.json({ error: "포인트 기능이 비활성화되어 있습니다." }, { status: 400 });

  const { amount } = await req.json().catch(() => ({}));
  try {
    // TODO: PG(신용카드) 결제 승인 연동 지점 — 승인 성공 시에만 chargePoints 호출
    const result = await chargePoints(user.id, Number(amount));
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "INVALID_AMOUNT")
      return NextResponse.json({ error: "충전할 금액을 정확히 입력해주세요." }, { status: 400 });
    return NextResponse.json({ error: "충전에 실패했습니다." }, { status: 500 });
  }
}
