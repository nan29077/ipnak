import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 더미 사용자 이메일 패턴
const DUMMY_EMAIL_PATTERN = "%@ipnak.test";

async function getDummyUserIds() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@ipnak.test" }, role: "ANGLER" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    const { type } = await req.json();
    if (!type) return NextResponse.json({ error: "type 필수" }, { status: 400 });

    const dummyIds = await getDummyUserIds();

    switch (type) {
      case "anglers": {
        // 더미 ANGLER 계정 및 모든 연관 데이터 삭제
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 회원이 없습니다." });

        await prisma.$transaction([
          prisma.postProductTag.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
          prisma.bookmark.deleteMany({ where: { userId: { in: dummyIds } } }),
          prisma.like.deleteMany({ where: { userId: { in: dummyIds } } }),
          prisma.comment.deleteMany({ where: { authorId: { in: dummyIds } } }),
          prisma.shareEvent.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
          prisma.report.deleteMany({ where: { reporterId: { in: dummyIds } } }),
          prisma.postImage.deleteMany({ where: { post: { authorId: { in: dummyIds } } } }),
        ]);
        await prisma.$transaction([
          prisma.catchRecord.deleteMany({ where: { userId: { in: dummyIds } } }),
          prisma.fishingPoint.deleteMany({ where: { userId: { in: dummyIds } } }),
          prisma.post.deleteMany({ where: { authorId: { in: dummyIds } } }),
        ]);
        const listings = await prisma.marketListing.findMany({ where: { sellerId: { in: dummyIds } }, select: { id: true } });
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
          prisma.session.deleteMany({ where: { userId: { in: dummyIds } } }),
        ]);
        await prisma.user.deleteMany({ where: { id: { in: dummyIds } } });
        return NextResponse.json({ message: `낚시꾼 더미 회원 ${dummyIds.length}명 삭제 완료` });
      }

      case "logs": {
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
        const logPosts = await prisma.post.findMany({ where: { kind: "LOG", authorId: { in: dummyIds } }, select: { id: true } });
        const logIds = logPosts.map((p) => p.id);
        if (logIds.length === 0) return NextResponse.json({ message: "삭제할 조행기 더미 데이터가 없습니다." });
        await prisma.postImage.deleteMany({ where: { postId: { in: logIds } } });
        await prisma.like.deleteMany({ where: { postId: { in: logIds } } });
        await prisma.comment.deleteMany({ where: { postId: { in: logIds } } });
        await prisma.post.deleteMany({ where: { id: { in: logIds } } });
        return NextResponse.json({ message: `조행기 더미 ${logIds.length}개 삭제 완료` });
      }

      case "feeds-fishing": {
        // 피싱 피드 = kind=FEED, speciesName 있는 것
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
        const feedPosts = await prisma.post.findMany({
          where: { kind: "FEED", authorId: { in: dummyIds }, NOT: { speciesName: null } },
          select: { id: true },
        });
        const feedIds = feedPosts.map((p) => p.id);
        if (feedIds.length === 0) return NextResponse.json({ message: "삭제할 피싱 피드 더미가 없습니다." });
        await prisma.postImage.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.like.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.comment.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.post.deleteMany({ where: { id: { in: feedIds } } });
        return NextResponse.json({ message: `피싱 피드 더미 ${feedIds.length}개 삭제 완료` });
      }

      case "feeds-general": {
        // 일반 피드 = kind=FEED, speciesName 없는 것
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
        const feedPosts = await prisma.post.findMany({
          where: { kind: "FEED", authorId: { in: dummyIds }, speciesName: null },
          select: { id: true },
        });
        const feedIds = feedPosts.map((p) => p.id);
        if (feedIds.length === 0) return NextResponse.json({ message: "삭제할 일상 피드 더미가 없습니다." });
        await prisma.postImage.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.like.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.comment.deleteMany({ where: { postId: { in: feedIds } } });
        await prisma.post.deleteMany({ where: { id: { in: feedIds } } });
        return NextResponse.json({ message: `일상 피드 더미 ${feedIds.length}개 삭제 완료` });
      }

      case "feeds-walking": {
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
        const walkPosts = await prisma.post.findMany({
          where: { kind: "WALKING", authorId: { in: dummyIds } },
          select: { id: true },
        });
        const walkIds = walkPosts.map((p) => p.id);
        if (walkIds.length === 0) return NextResponse.json({ message: "삭제할 워킹 피드 더미가 없습니다." });
        await prisma.like.deleteMany({ where: { postId: { in: walkIds } } });
        await prisma.post.deleteMany({ where: { id: { in: walkIds } } });
        return NextResponse.json({ message: `워킹 피드 더미 ${walkIds.length}개 삭제 완료` });
      }

      case "market": {
        if (dummyIds.length === 0) return NextResponse.json({ message: "삭제할 더미 데이터가 없습니다." });
        const listings = await prisma.marketListing.findMany({ where: { sellerId: { in: dummyIds } }, select: { id: true } });
        const listingIds = listings.map((l) => l.id);
        if (listingIds.length === 0) return NextResponse.json({ message: "삭제할 중고마켓 더미가 없습니다." });
        await prisma.$transaction([
          prisma.marketMessage.deleteMany({ where: { chat: { listingId: { in: listingIds } } } }),
          prisma.marketChat.deleteMany({ where: { listingId: { in: listingIds } } }),
          prisma.marketFavorite.deleteMany({ where: { listingId: { in: listingIds } } }),
          prisma.marketImage.deleteMany({ where: { listingId: { in: listingIds } } }),
          prisma.marketListing.deleteMany({ where: { id: { in: listingIds } } }),
        ]);
        return NextResponse.json({ message: `중고마켓 더미 ${listingIds.length}개 삭제 완료` });
      }

      case "products": {
        const count = await prisma.product.count({ where: { affiliateCode: "DUMMY_SEED" } });
        if (count === 0) return NextResponse.json({ message: "삭제할 쇼핑 상품 더미가 없습니다." });
        // FeaturedProduct (raw SQL, prisma generate 전 대응)
        await prisma.$executeRaw`DELETE FROM \`FeaturedProduct\` WHERE \`productId\` IN (SELECT id FROM \`Product\` WHERE \`affiliateCode\` = 'DUMMY_SEED')`.catch(() => {});
        await prisma.postProductTag.deleteMany({ where: { product: { affiliateCode: "DUMMY_SEED" } } });
        await prisma.product.deleteMany({ where: { affiliateCode: "DUMMY_SEED" } });
        return NextResponse.json({ message: `쇼핑 상품 더미 ${count}개 삭제 완료` });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 type" }, { status: 400 });
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
