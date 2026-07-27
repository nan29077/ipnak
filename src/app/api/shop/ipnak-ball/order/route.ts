import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { productId, quantity, addressId, memo } = body;

    if (!productId || !addressId) {
      return NextResponse.json({ error: "상품과 배송지를 선택해주세요." }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(5, Math.trunc(Number(quantity) || 1)));

    // 상품 조회
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "IpnakBallProduct" WHERE "id" = ? AND "isActive" = 1 LIMIT 1`,
      productId
    );
    if (products.length === 0) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }
    const product = products[0];
    if (product.stock < qty) {
      return NextResponse.json({ error: "재고가 부족합니다." }, { status: 409 });
    }

    // 배송지 조회
    const addresses = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "ShippingAddress" WHERE "id" = ? AND "userId" = ? LIMIT 1`,
      addressId,
      user.id
    );
    if (addresses.length === 0) {
      return NextResponse.json({ error: "배송지를 찾을 수 없습니다." }, { status: 404 });
    }
    const addr = addresses[0];

    const totalPrice = product.price * qty;
    const id = randomUUID();
    const now = new Date().toISOString();

    // 주문 생성 + 재고 차감
    await prisma.$executeRawUnsafe(
      `UPDATE "IpnakBallProduct" SET "stock" = "stock" - ?, "updatedAt" = ? WHERE "id" = ? AND "stock" >= ?`,
      qty, now, productId, qty
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "IpnakBallOrder" ("id","userId","productId","quantity","totalPrice","status","addressName","address","addressDetail","phone","memo","createdAt","updatedAt")
       VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?)`,
      id, user.id, productId, qty, totalPrice,
      addr.name,
      addr.address,
      addr.addressDetail || null,
      addr.phone,
      memo || null,
      now, now
    );

    return NextResponse.json({ ok: true, orderId: id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : "주문 처리에 실패했습니다." },
      { status: e.message === "UNAUTHORIZED" ? 401 : 500 }
    );
  }
}
