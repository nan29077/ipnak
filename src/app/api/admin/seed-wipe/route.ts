import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 더미 데이터 삭제 API
 * - ANGLER 역할의 모든 사용자와 그들의 게시글/중고마켓/댓글 등을 삭제
 * - SUPER_ADMIN 계정은 보존
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req as any);
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 삭제 대상: ANGLER 계정 전체
    const dummyUsers = await prisma.user.findMany({
      where: { role: "ANGLER" },
      select: { id: true },
    });
    const dummyIds = dummyUsers.map((u) => u.id);

    if (dummyIds.length === 0) {
      return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
    }

    // 연관 데이터 삭제 (Prisma cascade가 안 되는 것들 수동 삭제)
    await prisma.$transaction([
      // 게시글 관련
      prisma.postProductTag.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
      prisma.bookmark.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.like.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.comment.deleteMany({ where: { authorId: { in: dummyIds } } }),
      prisma.shareEvent.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
      prisma.report.deleteMany({ where: { reporterId: { in: dummyIds } } }),
      prisma.postImage.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
    ]);

    await prisma.$transaction([
      prisma.gearSetup.deleteMany({ where: { catchRecord: { userId: { in: dummyIds } } } }),
      prisma.catchRecord.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.fishingPoint.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.routePoint.deleteMany({ where: { trip: { userId: { in: dummyIds } } } }),
      prisma.fishingTrip.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.post.deleteMany({ where: { authorId: { in: dummyIds } } }),
    ]);

    await prisma.$transaction([
      // 중고마켓 관련
      prisma.marketMessage.deleteMany({ where: { senderId: { in: dummyIds } } }),
      prisma.marketChat.deleteMany({ where: { buyerId: { in: dummyIds } } }),
      prisma.marketFavorite.deleteMany({ where: { userId: { in: dummyIds } } }),
    ]);

    // 판매자로서의 중고마켓
    const listings = await prisma.marketListing.findMany({
      where: { sellerId: { in: dummyIds } },
      select: { id: true },
    });
    const listingIds = listings.map((l) => l.id);
    if (listingIds.length > 0) {
      await prisma.$transaction([
        prisma.marketMessage.deleteMany({ where: { chat: { listingId: { in: listingIds } } } }),
        prisma.marketChat.deleteMany({ where: { listingId: { in: listingIds } } }),
        prisma.marketFavorite.deleteMany({ where: { listingId: { in: listingIds } } }),
        prisma.marketImage.deleteMany({ where: { listingId: { in: listingIds } } }),
        prisma.marketListing.deleteMany({ where: { id: { in: listingIds } } }),
      ]);
    }

    await prisma.$transaction([
      prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: dummyIds } }, { followingId: { in: dummyIds } }] } }),
      prisma.notification.deleteMany({ where: { OR: [{ userId: { in: dummyIds } }, { actorId: { in: dummyIds } }] } }),
      prisma.tournamentEntry.deleteMany({ where: { userId: { in: dummyIds } } }),
      prisma.session.deleteMany({ where: { userId: { in: dummyIds } } }),
    ]);

    // 사용자 삭제
    await prisma.user.deleteMany({ where: { id: { in: dummyIds } } });

    return NextResponse.json({
      message: `더미 데이터 삭제 완료. 삭제된 ANGLER 계정: ${dummyIds.length}개`,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
