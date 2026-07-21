import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/points/transactions?filter=earn|spend|all — 포인트 내역
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all";

  const where: any = { userId: user.id };
  if (filter === "earn") where.amount = { gt: 0 };
  else if (filter === "spend") where.amount = { lt: 0 };

  try {
    const rows = await prisma.pointTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
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
