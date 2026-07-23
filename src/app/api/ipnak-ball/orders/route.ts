import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoolSetting, getSetting } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ANGLER") return NextResponse.json({ error: "낚시꾼 계정만 구매할 수 있습니다." }, { status: 403 });
    if (!(await getBoolSetting("ipnak_ball_enabled"))) return NextResponse.json({ error: "현재 입낚볼 판매가 중지되었습니다." }, { status: 409 });
    const b = await req.json();
    const required = ["buyerName", "buyerPhone", "recipientName", "recipientPhone", "postalCode", "address"];
    if (required.some((k) => !String(b[k] || "").trim())) return NextResponse.json({ error: "필수 구매자·배송 정보를 모두 입력해 주세요." }, { status: 400 });
    const quantity = Math.max(1, Math.min(10, Math.trunc(Number(b.quantity) || 1)));
    const unitPrice = Number(await getSetting("ipnak_ball_price"));
    if (!Number.isInteger(unitPrice) || unitPrice < 100) return NextResponse.json({ error: "판매 가격 설정을 확인해 주세요." }, { status: 503 });
    // PG 연동 지점: 현재는 범용 테스트 PG 승인을 거친 것으로 기록한다.
    const now = new Date();
    const order = await prisma.ballOrder.create({ data: {
      orderNo: `IB${now.toISOString().slice(0,10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
      userId: user.id, quantity, unitPrice, totalPrice: unitPrice * quantity,
      buyerName: String(b.buyerName).trim(), buyerPhone: String(b.buyerPhone).trim(), buyerEmail: String(b.buyerEmail || "").trim() || null,
      recipientName: String(b.recipientName).trim(), recipientPhone: String(b.recipientPhone).trim(), postalCode: String(b.postalCode).trim(),
      address: String(b.address).trim(), addressDetail: String(b.addressDetail || "").trim() || null, deliveryMemo: String(b.deliveryMemo || "").trim() || null,
      status: "PAID", paymentStatus: "PAID", paymentMethod: String(b.paymentMethod || "card"), paymentKey: `TEST_${randomBytes(8).toString("hex")}`, paidAt: now,
    }});
    return NextResponse.json({ ok: true, orderNo: order.orderNo });
  } catch (e: any) {
    return NextResponse.json({ error: e.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : "주문 처리에 실패했습니다." }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
