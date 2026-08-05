import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureIpnakRawColumns, normalizeProductType } from "@/lib/ipnakProduct";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    await ensureIpnakRawColumns();

    // ?type=ball | keyring — 상품(IpnakBallProduct)의 type으로 필터링, 없으면 전체
    const rawType = new URL(req.url).searchParams.get("type");
    const type = rawType ? normalizeProductType(rawType) : null;

    // IpnakBallOrder + User + IpnakBallProduct JOIN (raw SQL, Prisma client 미재생성 대응)
    const sql = `
      SELECT
        o.id, o."userId", o."productId", o.quantity, o."totalPrice",
        o.status, o."trackingNumber", o."addressName", o.address, o."addressDetail",
        o.phone, o.memo, o."createdAt", o."updatedAt",
        u.nickname AS "userNickname", u.email AS "userEmail",
        p.name AS "productName", p.price AS "productPrice", p."type" AS "productType"
      FROM \`IpnakBallOrder\` o
      JOIN \`User\` u ON u.id = o.\`userId\`
      JOIN \`IpnakBallProduct\` p ON p.id = o.\`productId\`
      ${type ? `WHERE p.\`type\` = ?` : ""}
      ORDER BY o.\`createdAt\` DESC
      LIMIT 200
    `;
    const orders = type
      ? await prisma.$queryRawUnsafe<any[]>(sql, type)
      : await prisma.$queryRawUnsafe<any[]>(sql);

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

    // 취소 전환 시 재고 복원
    if (status === "cancelled") {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT o.status, o.quantity, o.\`productId\` FROM \`IpnakBallOrder\` o WHERE o.id = ?`, id
      );
      const order = rows[0];
      if (order && order.status !== \`cancelled\` && order.productId && order.quantity) {
        await prisma.$executeRawUnsafe(
          `UPDATE \`IpnakBallProduct\` SET \`stock\` = \`stock\` + ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
          order.quantity, new Date().toISOString(), order.productId
        ).catch(() => {});
      }
    }

    const now = new Date().toISOString();
    if (trackingNumber !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE \`IpnakBallOrder\` SET \`status\` = ?, \`trackingNumber\` = ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
        status, trackingNumber || null, now, id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE \`IpnakBallOrder\` SET \`status\` = ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
        status, now, id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "상태 변경에 실패했습니다." }, { status: 500 });
  }
}
