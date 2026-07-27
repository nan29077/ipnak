import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "IpnakBallProduct" WHERE "isActive" = 1 ORDER BY "createdAt" ASC`
    );
    return NextResponse.json({ products: products.map((p) => ({ ...p, isActive: Boolean(p.isActive), optionEnabled: Boolean(p.optionEnabled) })) });
  } catch {
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
