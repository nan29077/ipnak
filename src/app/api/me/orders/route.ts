import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { refundSpentPoints, resolveUsablePoints, spendPoints } from "@/lib/points";

export const dynamic = "force-dynamic";

async function ensureTable() {
  // VARCHAR 타입 — SQLite/MariaDB 양쪽에서 동작 (MariaDB는 TEXT 컬럼을 PRIMARY KEY로 쓸 수 없다)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`Order\` (
      \`id\`                VARCHAR(191) NOT NULL PRIMARY KEY,
      \`userId\`            VARCHAR(191) NOT NULL,
      \`productId\`         VARCHAR(191) NOT NULL,
      \`productName\`       VARCHAR(255) NOT NULL,
      \`price\`             INTEGER NOT NULL DEFAULT 0,
      \`quantity\`          INTEGER NOT NULL DEFAULT 1,
      \`shippingFee\`       INTEGER NOT NULL DEFAULT 0,
      \`totalAmount\`       INTEGER NOT NULL DEFAULT 0,
      \`pointsUsed\`        INTEGER NOT NULL DEFAULT 0,
      \`shippingAddressId\` VARCHAR(191),
      \`status\`            VARCHAR(32) NOT NULL DEFAULT 'PAID',
      \`paymentMethod\`     VARCHAR(32) NOT NULL DEFAULT 'CARD',
      \`createdAt\`         VARCHAR(64) NOT NULL
    )
  `);
  // 이 컬럼이 생기기 전에 만들어진 테이블에 뒤늦게 추가한다.
  // SQLite 는 ADD COLUMN IF NOT EXISTS 를 지원하지 않으므로 중복 실행 오류는 무시한다.
  await prisma
    .$executeRawUnsafe(`ALTER TABLE \`Order\` ADD COLUMN \`pointsUsed\` INTEGER NOT NULL DEFAULT 0`)
    .catch(() => {});
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  try {
    await ensureTable();
    const orders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM \`Order\` WHERE \`userId\` = ? ORDER BY \`createdAt\` DESC`,
      user.id,
    );
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "주문 내역을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  try { await ensureTable(); } catch { return NextResponse.json({ error: "주문 처리 중 오류가 발생했습니다." }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { productId, productName, quantity, shippingAddressId, paymentMethod } = body;
  if (!productId || !productName) return NextResponse.json({ error: "상품 정보가 필요합니다." }, { status: 400 });

  // 가격/배송비/총액은 클라이언트 전송값을 신뢰하지 않고 서버에서 상품 정보로 재계산 (금액 조작 방지)
  const product = await prisma.product.findUnique({
    where: { id: String(productId) },
    select: { name: true, price: true, shippingFee: true, freeShippingThreshold: true, stock: true },
  });
  if (!product) return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });

  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));

  // 재고 확인 — stock이 0 이상으로 설정된 상품만 재고 체크 (0은 재고 무제한으로 간주)
  const currentStock = (product as any).stock ?? 0;
  if (currentStock > 0 && currentStock < qty) {
    return NextResponse.json(
      { error: currentStock === 0 ? "품절된 상품입니다." : `재고가 부족합니다. (남은 재고: ${currentStock}개)` },
      { status: 400 },
    );
  }

  const threshold = product.freeShippingThreshold ?? 0;
  const effectiveShippingFee = threshold > 0 && product.price * qty >= threshold ? 0 : (product.shippingFee ?? 0);
  const totalAmount = product.price * qty + effectiveShippingFee;

  // 사용할 포인트는 클라이언트 값을 신뢰하지 않고 서버에서 보유 포인트·결제금액 기준으로 클램프한다.
  const pointsUsed = await resolveUsablePoints(user.id, body.usePoints, totalAmount);

  const id = randomUUID();
  const now = new Date().toISOString();

  let stockDecremented = false;
  let pointsSpent = 0;
  try {
    // 재고 차감 (stock > 0 인 경우만) + 주문 INSERT — 재고 부족 시 차감이 실패해 주문도 막힘
    if (currentStock > 0) {
      const updated = await prisma.product.updateMany({
        where: { id: String(productId), stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "재고가 부족합니다. 다시 시도해 주세요." }, { status: 400 });
      }
      stockDecremented = true;
    }
    // 포인트 차감 — 잔액이 모자라면 트랜잭션이 롤백되며 INSUFFICIENT_POINTS 를 던진다(잔액 음수 불가)
    if (pointsUsed > 0) {
      try {
        await spendPoints(user.id, pointsUsed, "SHOPPING", product.name);
        pointsSpent = pointsUsed;
      } catch (e: any) {
        if (stockDecremented) {
          await prisma.product.update({
            where: { id: String(productId) },
            data: { stock: { increment: qty } },
          }).catch(() => {});
        }
        return NextResponse.json(
          { error: e?.message === "INSUFFICIENT_POINTS" ? "보유 포인트가 부족합니다." : "포인트 사용에 실패했습니다." },
          { status: 400 },
        );
      }
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`Order\` (\`id\`,\`userId\`,\`productId\`,\`productName\`,\`price\`,\`quantity\`,\`shippingFee\`,\`totalAmount\`,\`pointsUsed\`,\`shippingAddressId\`,\`status\`,\`paymentMethod\`,\`createdAt\`)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, user.id, String(productId), product.name,
      product.price, qty, effectiveShippingFee, totalAmount, pointsSpent,
      shippingAddressId ?? null, "PAID", paymentMethod ?? "CARD", now,
    );
  } catch {
    // INSERT 실패 시 차감한 재고·포인트를 원복한다
    if (stockDecremented) {
      await prisma.product.update({
        where: { id: String(productId) },
        data: { stock: { increment: qty } },
      }).catch(() => {});
    }
    if (pointsSpent > 0) await refundSpentPoints(user.id, pointsSpent, "SHOPPING");
    return NextResponse.json({ error: "주문 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, pointsUsed: pointsSpent, paidAmount: totalAmount - pointsSpent });
}
