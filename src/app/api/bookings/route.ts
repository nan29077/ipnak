import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getBoolSetting } from "@/lib/settings";

export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  // 예약 기능 스위치 OFF: API 레벨에서 예약 생성 차단
  const reservationEnabled = await getBoolSetting("reservation_enabled");
  if (!reservationEnabled) {
    return NextResponse.json({ error: "예약 서비스가 현재 비활성화되어 있습니다." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  if (!b.listingId || typeof b.listingId !== "string") return NextResponse.json({ error: "상품 정보가 올바르지 않습니다." }, { status: 400 });
  const listing = await prisma.reservationListing.findUnique({ where: { id: b.listingId } });
  if (!listing) return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  const people = Math.max(1, Number(b.people) || 1);
  // 잘못된 날짜 문자열이 Prisma로 전달되어 500이 나지 않도록 검증 (Invalid Date 방지)
  const parsedDate = new Date(b.date || Date.now());
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  try {
    const booking = await prisma.booking.create({
      data: { listingId: listing.id, userId: user.id, date, people, totalPrice: listing.price * people, status: "REQUESTED" },
    });
    return NextResponse.json({ ok: true, id: booking.id });
  } catch {
    return NextResponse.json({ error: "예약 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
