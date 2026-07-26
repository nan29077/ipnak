import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 상품 통계 조회 (관심 수, 채팅 수, 조회 수)
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: params.id },
    select: {
      viewCount: true,
      _count: { select: { favorites: true, chats: true } },
    },
  });
  if (!listing) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    favoriteCount: listing._count.favorites,
    chatCount: listing._count.chats,
    viewCount: listing.viewCount,
  });
}
