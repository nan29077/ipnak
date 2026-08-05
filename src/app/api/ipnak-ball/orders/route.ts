import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import {
  IPNAK_ENABLED_KEY,
  IPNAK_TYPE_LABEL,
  ensureIpnakRawColumns,
  normalizeProductType,
} from "@/lib/ipnakProduct";
import { refundSpentPoints, resolveUsablePoints, spendPoints } from "@/lib/points";
import { toDbDate } from "@/lib/dbDate";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ANGLER") return NextResponse.json({ error: "낚시꾼 계정만 구매할 수 있습니다." }, { status: 403 });
    await ensureIpnakRawColumns();
    const b = await req.json();
    const productType = normalizeProductType(b.productType);
    const label = IPNAK_TYPE_LABEL[productType];
    if (!(await getBoolSetting(IPNAK_ENABLED_KEY[productType])))
      return NextResponse.json({ error: `현재 ${label} 판매가 중지되었습니다.` }, { status: 409 });
    const required = ["buyerName", "buyerPhone", "recipientName", "recipientPhone", "postalCode", "address"];
    if (required.some((k) => !String(b[k] || "").trim())) return NextResponse.json({ error: "필수 구매자·배송 정보를 모두 입력해 주세요." }, { status: 400 });
    const quantity = Math.max(1, Math.min(10, Math.trunc(Number(b.quantity) || 1)));

    // 단가: 해당 타입 상품 레코드의 price가 기준. 옵션이 켜져 있으면 선택한 옵션 가격을 우선한다.
    const selectedOption = b.selectedOption === "one" || b.selectedOption === "two" ? b.selectedOption : null;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM \`IpnakBallProduct\` WHERE \`isActive\` = 1 AND \`type\` = ? ORDER BY \`createdAt\` ASC LIMIT 1`,
      productType
    );
    const product = rows[0];
    if (!product) return NextResponse.json({ error: `판매 중인 ${label} 상품이 없습니다.` }, { status: 409 });
    let unitPrice = Number(product.price);
    if (Boolean(product.optionEnabled)) {
      if (!selectedOption) return NextResponse.json({ error: "옵션을 선택해 주세요." }, { status: 400 });
      const optionPrice = selectedOption === "one" ? product.optionOnePrice : product.optionTwoPrice;
      if (optionPrice != null) unitPrice = Number(optionPrice);
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 100) return NextResponse.json({ error: `${label} 판매 가격을 확인해 주세요.` }, { status: 503 });

    // 재고 차감 — 관리자 상품 관리에서 설정한 재고를 실제로 반영한다.
    // 조건부 UPDATE의 영향 행 수를 확인해 동시 주문 시 재고 초과 판매를 막는다.
    const affected = await prisma.$executeRawUnsafe(
      `UPDATE \`IpnakBallProduct\` SET \`stock\` = \`stock\` - ?, \`updatedAt\` = ? WHERE \`id\` = ? AND \`stock\` >= ?`,
      quantity, toDbDate(), product.id, quantity
    );
    if (affected === 0) return NextResponse.json({ error: `${label} 재고가 부족합니다.` }, { status: 409 });

    // 포인트 사용 — 클라이언트 값을 신뢰하지 않고 보유 포인트·결제금액 기준으로 서버에서 클램프한다.
    // 잔액이 모자라면 spendPoints 내부 트랜잭션이 롤백되며 INSUFFICIENT_POINTS 를 던진다(잔액 음수 불가).
    const totalPrice = unitPrice * quantity;
    const pointSource = productType === "keyring" ? "IPNAK_KEYRING" : "IPNAK_BALL";
    const usable = await resolveUsablePoints(user.id, b.usePoints, totalPrice);
    let pointsUsed = 0;
    if (usable > 0) {
      try {
        await spendPoints(user.id, usable, pointSource, label);
        pointsUsed = usable;
      } catch (pointError: any) {
        // 포인트 차감이 실패하면 위에서 차감한 재고를 되돌린다.
        await prisma.$executeRawUnsafe(
          `UPDATE \`IpnakBallProduct\` SET \`stock\` = \`stock\` + ? WHERE \`id\` = ?`, quantity, product.id
        ).catch(() => {});
        return NextResponse.json(
          { error: pointError?.message === "INSUFFICIENT_POINTS" ? "보유 포인트가 부족합니다." : "포인트 사용에 실패했습니다." },
          { status: 400 },
        );
      }
    }

    // PG 연동 지점: 현재는 범용 테스트 PG 승인을 거친 것으로 기록한다.
    const now = new Date();
    let order;
    try {
      order = await prisma.ballOrder.create({ data: {
        orderNo: `${productType === "keyring" ? "IK" : "IB"}${now.toISOString().slice(0,10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
        userId: user.id, quantity, unitPrice, totalPrice,
        buyerName: String(b.buyerName).trim(), buyerPhone: String(b.buyerPhone).trim(), buyerEmail: String(b.buyerEmail || "").trim() || null,
        recipientName: String(b.recipientName).trim(), recipientPhone: String(b.recipientPhone).trim(), postalCode: String(b.postalCode).trim(),
        address: String(b.address).trim(), addressDetail: String(b.addressDetail || "").trim() || null, deliveryMemo: String(b.deliveryMemo || "").trim() || null,
        status: "PAID", paymentStatus: "PAID", paymentMethod: String(b.paymentMethod || "card"), paymentKey: `TEST_${randomBytes(8).toString("hex")}`, paidAt: now,
      }});
    } catch (createError) {
      // 주문 생성이 실패하면 위에서 차감한 재고·포인트를 되돌린다.
      await prisma.$executeRawUnsafe(
        `UPDATE \`IpnakBallProduct\` SET \`stock\` = \`stock\` + ? WHERE \`id\` = ?`, quantity, product.id
      ).catch(() => {});
      if (pointsUsed > 0) await refundSpentPoints(user.id, pointsUsed, pointSource);
      throw createError;
    }
    // productType·productId·pointsUsed는 Prisma 스키마에 없는 raw 컬럼이라 생성 직후 별도로 기록한다.
    // productId는 위에서 실제로 재고를 차감한 상품 레코드 — 취소·환불 시 이 상품으로 되돌린다.
    await prisma.$executeRawUnsafe(
      `UPDATE \`BallOrder\` SET \`productType\` = ?, \`productId\` = ?, \`pointsUsed\` = ? WHERE \`id\` = ?`,
      productType, product.id, pointsUsed, order.id
    );
    return NextResponse.json({ ok: true, orderNo: order.orderNo, pointsUsed, paidAmount: totalPrice - pointsUsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : "주문 처리에 실패했습니다." }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
