import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  if (!b.listingId || typeof b.listingId !== "string") return NextResponse.json({ error: "상품 정보가 올바르지 않습니다." }, { status: 400 });
  const listing = await prisma.reservationListing.findUnique({ where: { id: b.listingId } });
  if (!listing) return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  const people = Math.max(1, Number(b.people) || 1);
  const booking = await prisma.booking.create({
    data: { listingId: listing.id, userId: user.id, date: new Date(b.date || Date.now()), people, totalPrice: listing.price * people, status: "REQUESTED" },
  });
  return NextResponse.json({ ok: true, id: booking.id });
}
