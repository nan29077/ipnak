import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { adminTopup } from "@/lib/points";

export const dynamic = "force-dynamic";

// POST /api/admin/points/topup { userId, amount, memo } — 관리자 임의 충전/차감
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireUser();
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { userId, amount, memo } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "대상 회원이 없습니다." }, { status: 400 });

  try {
    const result = await adminTopup(admin.id, String(userId), Number(amount), memo);
    await prisma.adminLog.create({
      data: { actorId: admin.id, action: "POINT_TOPUP", target: String(userId), detail: `${amount}P` },
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "INVALID_AMOUNT")
      return NextResponse.json({ error: "지급할 포인트를 정확히 입력해주세요." }, { status: 400 });
    if (e.message === "INSUFFICIENT_POINTS")
      return NextResponse.json({ error: "차감할 포인트가 회원 잔액을 초과합니다." }, { status: 400 });
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}
