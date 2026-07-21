import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/points/history?userId=&filter=all|earn|spend — 특정 회원의 포인트 내역(관리자)
export async function GET(req: Request) {
  let admin;
  try {
    admin = await requireUser();
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const filter = searchParams.get("filter") || "all";
  if (!userId) return NextResponse.json({ error: "대상 회원이 없습니다." }, { status: 400 });

  const where: any = { userId };
  if (filter === "earn") where.amount = { gt: 0 };
  else if (filter === "spend") where.amount = { lt: 0 };

  try {
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, nickname: true, email: true, points: true } }),
      prisma.pointTransaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    // 충전(증가)/차감(감소) 합계 요약
    const chargedSum = await prisma.pointTransaction.aggregate({ where: { userId, amount: { gt: 0 } }, _sum: { amount: true } });
    const spentSum = await prisma.pointTransaction.aggregate({ where: { userId, amount: { lt: 0 } }, _sum: { amount: true } });

    return NextResponse.json({
      user,
      totalCharged: chargedSum._sum.amount ?? 0,
      totalSpent: Math.abs(spentSum._sum.amount ?? 0),
      transactions: rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}
