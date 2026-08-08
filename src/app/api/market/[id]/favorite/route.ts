import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 찜 토글
export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  try {
    const existing = await prisma.marketFavorite.findUnique({
      where: { listingId_userId: { listingId: params.id, userId: user.id } },
    });
    if (existing) await prisma.marketFavorite.delete({ where: { id: existing.id } });
    else await prisma.marketFavorite.create({ data: { listingId: params.id, userId: user.id } });
    const count = await prisma.marketFavorite.count({ where: { listingId: params.id } });
    return NextResponse.json({ favorited: !existing, count });
  } catch {
    // 삭제된 판매글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "판매글을 찾을 수 없습니다." }, { status: 404 });
  }
}
