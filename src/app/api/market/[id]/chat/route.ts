import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 판매자와의 채팅방 생성 또는 조회 (구매자 기준)
export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const listing = await prisma.marketListing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "판매글을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId === user.id) return NextResponse.json({ error: "본인 판매글에는 채팅할 수 없습니다." }, { status: 400 });

  const chat = await prisma.marketChat.upsert({
    where: { listingId_buyerId: { listingId: params.id, buyerId: user.id } },
    update: {},
    create: { listingId: params.id, buyerId: user.id },
  });
  return NextResponse.json({ ok: true, chatId: chat.id });
}
