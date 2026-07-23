import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const admin = await requireUser();
    if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    const b = await req.json();
    const allowed = ["REQUESTED", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
    if (!b.id || !allowed.includes(b.status)) return NextResponse.json({ error: "올바른 주문 상태가 아닙니다." }, { status: 400 });
    const data: any = { status: b.status };
    if (b.status === "PAID") { data.paymentStatus = "PAID"; data.paidAt = new Date(); }
    if (b.status === "CANCELLED") data.paymentStatus = "CANCELLED";
    if (b.status === "REFUNDED") data.paymentStatus = "REFUNDED";
    if (b.status === "SHIPPED") { if (!String(b.carrier || "").trim() || !String(b.trackingNumber || "").trim()) return NextResponse.json({ error: "배송사와 송장번호를 입력해 주세요." }, { status: 400 }); data.carrier = String(b.carrier).trim(); data.trackingNumber = String(b.trackingNumber).trim(); data.shippedAt = new Date(); }
    if (b.status === "DELIVERED") data.deliveredAt = new Date();
    const order = await prisma.ballOrder.update({ where: { id: b.id }, data });
    await prisma.adminLog.create({ data: { actorId: admin.id, action: `BALL_ORDER_${b.status}`, target: b.id, detail: order.orderNo } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : "처리에 실패했습니다." }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 }); }
}
