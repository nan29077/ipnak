import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    // IpnakBallOrder + User + IpnakBallProduct JOIN (raw SQL, Prisma client 미재생성 대응)
    const orders = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        o.id, o."userId", o."productId", o.quantity, o."totalPrice",
        o.status, o."trackingNumber", o."addressName", o.address, o."addressDetail",
        o.phone, o.memo, o."createdAt", o."updatedAt",
        u.nickname AS "userNickname", u.email AS "userEmail",
        p.name AS "productName", p.price AS "productPrice"
      FROM "IpnakBallOrder" o
      JOIN "User" u ON u.id = o."userId"
      JOIN "IpnakBallProduct" p ON p.id = o."productId"
      ORDER BY o."createdAt" DESC
      LIMIT 200
    `);

    return NextResponse.json({ orders });
  } catch (e: any) {
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    const body = await req.json();
    const { id, status, trackingNumber } = body;
    if (!id || !ALLOWED_STATUSES.includes(status))
      return NextResponse.json({ error: "올바른 요청이 아닙니다." }, { status: 400 });

    const now = new Date().toISOString();
    if (trackingNumber !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "IpnakBallOrder" SET "status" = ?, "trackingNumber" = ?, "updatedAt" = ? WHERE "id" = ?`,
        status, trackingNumber || null, now, id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "IpnakBallOrder" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?`,
        status, now, id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "상태 변경에 실패했습니다." }, { status: 500 });
  }
}
