import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureIpnakRawColumns, normalizeProductType } from "@/lib/ipnakProduct";
import { refundSpentPoints } from "@/lib/points";

// 재고(및 사용 포인트)를 되돌려야 하는 종료 상태
const STOCK_RESTORING = ["CANCELLED", "REFUNDED"];

export async function PATCH(req: Request) {
  try {
    const admin = await requireUser();
    if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    await ensureIpnakRawColumns();
    const b = await req.json();
    const allowed = ["REQUESTED", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
    if (!b.id || !allowed.includes(b.status)) return NextResponse.json({ error: "올바른 주문 상태가 아닙니다." }, { status: 400 });

    // 재고·포인트 복원 판단에 이전 상태·수량이 필요하다. productId/productType/pointsUsed는 raw 컬럼이라 따로 읽는다.
    const prevRows = await prisma.$queryRawUnsafe<
      { status: string; quantity: number; productId: string | null; productType: string | null; pointsUsed: number | null; userId: string }[]
    >(
      `SELECT \`status\`, \`quantity\`, \`productId\`, \`productType\`, \`pointsUsed\`, \`userId\` FROM \`BallOrder\` WHERE \`id\` = ?`, b.id
    );
    const prev = prevRows[0];
    if (!prev) return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

    const data: any = { status: b.status };
    if (b.status === "PAID") { data.paymentStatus = "PAID"; data.paidAt = new Date(); }
    if (b.status === "CANCELLED") data.paymentStatus = "CANCELLED";
    if (b.status === "REFUNDED") data.paymentStatus = "REFUNDED";
    if (b.status === "SHIPPED") { if (!String(b.carrier || "").trim() || !String(b.trackingNumber || "").trim()) return NextResponse.json({ error: "배송사와 송장번호를 입력해 주세요." }, { status: 400 }); data.carrier = String(b.carrier).trim(); data.trackingNumber = String(b.trackingNumber).trim(); data.shippedAt = new Date(); }
    if (b.status === "DELIVERED") data.deliveredAt = new Date();
    const order = await prisma.ballOrder.update({ where: { id: b.id }, data });

    /* 취소·환불 시 재고 복원.
       - 이전 상태가 이미 취소·환불이면 건너뛴다(취소 → 환불처럼 두 번 눌러도 중복 복원 방지).
       - productId가 NULL인 주문(컬럼 추가 이전의 기존 데이터)은 어느 상품에서 차감됐는지
         알 수 없으므로 복원하지 않는다. */
    let restored = 0;
    if (STOCK_RESTORING.includes(b.status) && !STOCK_RESTORING.includes(prev.status) && prev.productId) {
      // 상품이 이미 삭제됐으면 영향 행이 0 — 그 경우 복원한 것으로 기록하지 않는다.
      const affected = await prisma.$executeRawUnsafe(
        `UPDATE \`IpnakBallProduct\` SET \`stock\` = \`stock\` + ?, \`updatedAt\` = ? WHERE \`id\` = ?`,
        prev.quantity, new Date().toISOString(), prev.productId
      );
      if (affected > 0) restored = prev.quantity;
    }

    /* 취소·환불 시 결제에 사용한 포인트 반환.
       재고 복원과 동일한 조건(이전 상태가 종료 상태가 아닐 때만)으로 중복 반환을 막는다. */
    let pointsRefunded = 0;
    const prevPoints = Number(prev.pointsUsed) || 0;
    if (STOCK_RESTORING.includes(b.status) && !STOCK_RESTORING.includes(prev.status) && prevPoints > 0) {
      await refundSpentPoints(
        prev.userId,
        prevPoints,
        normalizeProductType(prev.productType) === "keyring" ? "IPNAK_KEYRING" : "IPNAK_BALL",
      );
      pointsRefunded = prevPoints;
    }

    const details = [
      restored > 0 ? `재고 +${restored} 복원` : null,
      pointsRefunded > 0 ? `포인트 ${pointsRefunded.toLocaleString()}P 반환` : null,
    ].filter(Boolean);
    await prisma.adminLog.create({ data: {
      actorId: admin.id,
      action: `BALL_ORDER_${b.status}`,
      target: b.id,
      detail: details.length ? `${order.orderNo} (${details.join(" · ")})` : order.orderNo,
    }});
    return NextResponse.json({ ok: true, stockRestored: restored, pointsRefunded });
  } catch (e: any) { return NextResponse.json({ error: e.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : "처리에 실패했습니다." }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 }); }
}
