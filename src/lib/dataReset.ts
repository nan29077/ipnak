import { prisma } from "@/lib/prisma";
import { isSqliteDb } from "@/lib/dbDate";

// 데이터 초기화 — 최고관리자(SUPER_ADMIN) 계정과 최고관리자가 직접 등록한 콘텐츠만 남기고
// 나머지 회원·게시글·거래 데이터를 모두 삭제한다.
//
// 남기는 것
//  - SUPER_ADMIN 계정과 그 계정이 쓴 게시글·조행기·중고마켓 글
//  - 관리자가 등록하는 카탈로그·운영 데이터: Setting, AdminLog, FishingCategory, FishSpecies,
//    Product, FeaturedProduct, IpnakBallProduct, ReservationListing, Banner, Tournament,
//    CurationSection, ProAngler
// 지우는 것
//  - SUPER_ADMIN 이 아닌 모든 계정과 그 계정에 딸린 모든 데이터
//  - 주문·예약·포인트 거래·대회 참가·알림·신고 등 운영 중 쌓인 거래성 데이터 전체
//
// 스마트피싱 기록(FishingTrip/RoutePoint/CatchRecord)은 관리자 계정 것만 보존한다.
//
// 관리자 API(/api/admin/virtual)와 CLI 스크립트(prisma/reset-keep-admin.ts)가 같은 함수를 쓰도록
// "server-only" 는 붙이지 않는다. Prisma 를 직접 쓰므로 클라이언트 번들에 들어가면 빌드가 실패한다.

// dev/운영 DB 에는 schema.prisma 보다 늦게 반영된 테이블이 있을 수 있다
// (예: 낚시단 커뮤니티 GroupPost/GroupComment/GroupPostLike — JSON 저장 방식에서 이관 예정).
// 초기화가 "테이블이 없다"는 이유로 통째로 실패하지 않도록 아래 두 장치를 함께 쓴다.

/** 테이블 존재 확인 (SQLite/MariaDB) — 없는 테이블 삭제를 아예 건너뛰어 불필요한 오류 로그를 남기지 않는다. */
export async function tableExists(name: string): Promise<boolean> {
  const sql = isSqliteDb()
    ? `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name = ?`
    : `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
  const rows = await prisma
    .$queryRawUnsafe<{ n: number | bigint }[]>(sql, name)
    .catch(() => [] as { n: number | bigint }[]);
  return Number(rows?.[0]?.n ?? 0) > 0;
}

/** 낚시단 커뮤니티 게시글 3개 테이블이 모두 반영되어 있는지 */
export async function groupPostTablesExist(): Promise<boolean> {
  const results = await Promise.all(["GroupPost", "GroupComment", "GroupPostLike"].map(tableExists));
  return results.every(Boolean);
}

/**
 * 안전망 — 테이블 부재(P2021)만 무시하고 나머지 오류는 그대로 올려 실제 문제를 숨기지 않는다.
 * tableExists 확인과 실제 삭제 사이에 스키마가 바뀌는 경우를 대비한다.
 */
export async function ignoreMissingTable<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2021") return null;
    throw e;
  }
}

export type DataResetSummary = {
  deletedUsers: number;
  deletedPosts: number;
  deletedMarketListings: number;
  deletedGroups: number;
  keptAdmins: number;
};

export async function resetToSuperAdminOnly(): Promise<DataResetSummary> {
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  const adminIds = admins.map((a) => a.id);

  const targets = await prisma.user.findMany({
    where: { role: { not: "SUPER_ADMIN" } },
    select: { id: true },
  });
  const targetIds = targets.map((t) => t.id);

  // 삭제 예정 건수 (보고용 — 실제 삭제 전에 센다)
  const [postCount, listingCount, groupCount] = await Promise.all([
    prisma.post.count({ where: { authorId: { in: targetIds } } }),
    prisma.marketListing.count({ where: { sellerId: { notIn: adminIds } } }),
    prisma.group.count({ where: { leaderId: { notIn: adminIds } } }),
  ]);

  // 1) 거래성·파생 데이터 전체 삭제 (관리자 것도 포함 — 등록 콘텐츠가 아니다)
  await prisma.$transaction([
    prisma.virtualActivity.deleteMany(),
    prisma.virtualMember.deleteMany(),
    prisma.pointTransaction.deleteMany(),
    prisma.walkingFeedUnlock.deleteMany(),
    prisma.linkedBall.deleteMany(),
    prisma.ballOrder.deleteMany(),
    prisma.ipnakBallOrder.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.tournamentEntry.deleteMany(),
    prisma.referralEvent.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.report.deleteMany(),
    prisma.shareEvent.deleteMany(),
    prisma.follow.deleteMany(),
  ]);

  // 2) 중고마켓 — 관리자 소유가 아닌 판매글과, 대상 회원이 남긴 채팅·찜 삭제
  const listings = await prisma.marketListing.findMany({
    where: { sellerId: { notIn: adminIds } },
    select: { id: true },
  });
  const listingIds = listings.map((l) => l.id);
  await prisma.$transaction([
    prisma.marketMessage.deleteMany({ where: { OR: [{ senderId: { in: targetIds } }, { chat: { listingId: { in: listingIds } } }] } }),
    prisma.marketChat.deleteMany({ where: { OR: [{ buyerId: { in: targetIds } }, { listingId: { in: listingIds } }] } }),
    prisma.marketFavorite.deleteMany({ where: { OR: [{ userId: { in: targetIds } }, { listingId: { in: listingIds } }] } }),
    prisma.marketImage.deleteMany({ where: { listingId: { in: listingIds } } }),
    prisma.marketListing.deleteMany({ where: { id: { in: listingIds } } }),
  ]);

  // 3) 낚시단 — 관리자가 개설한 낚시단만 남기고, 남는 낚시단에서도 대상 회원 흔적을 지운다
  // 커뮤니티 게시글 3개 테이블은 DB 미반영일 수 있어 존재할 때만 정리한다.
  if (await groupPostTablesExist()) {
    await ignoreMissingTable(() => prisma.groupPostLike.deleteMany({ where: { OR: [{ userId: { in: targetIds } }, { post: { authorId: { in: targetIds } } }] } }));
    await ignoreMissingTable(() => prisma.groupComment.deleteMany({ where: { OR: [{ authorId: { in: targetIds } }, { post: { authorId: { in: targetIds } } }] } }));
    await ignoreMissingTable(() => prisma.groupPost.deleteMany({ where: { authorId: { in: targetIds } } }));
  }
  await prisma.$transaction([
    prisma.groupPoint.deleteMany({ where: { authorId: { in: targetIds } } }),
    prisma.groupMember.deleteMany({ where: { userId: { in: targetIds } } }),
  ]);
  await prisma.group.deleteMany({ where: { leaderId: { notIn: adminIds } } });

  // 4) 게시글 — 대상 회원의 글, 그리고 남는 관리자 글에 달린 대상 회원의 댓글·반응 삭제
  await prisma.$transaction([
    prisma.postProductTag.deleteMany({ where: { post: { authorId: { in: targetIds } } } }),
    prisma.postImage.deleteMany({ where: { post: { authorId: { in: targetIds } } } }),
    prisma.curationFeature.deleteMany({ where: { post: { authorId: { in: targetIds } } } }),
    prisma.bookmark.deleteMany({ where: { OR: [{ userId: { in: targetIds } }, { post: { authorId: { in: targetIds } } }] } }),
    prisma.like.deleteMany({ where: { OR: [{ userId: { in: targetIds } }, { post: { authorId: { in: targetIds } } }] } }),
    prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: targetIds } }, { post: { authorId: { in: targetIds } } }] } }),
  ]);
  await prisma.post.deleteMany({ where: { authorId: { in: targetIds } } });

  // 5) 스마트피싱 기록 — 대상 회원 것만 삭제 (관리자 기록은 보존)
  await prisma.$transaction([
    prisma.gearSetup.deleteMany({ where: { catchRecord: { userId: { in: targetIds } } } }),
    prisma.catchRecord.deleteMany({ where: { userId: { in: targetIds } } }),
    prisma.fishingPoint.deleteMany({ where: { userId: { in: targetIds } } }),
    prisma.routePoint.deleteMany({ where: { trip: { userId: { in: targetIds } } } }),
    prisma.fishingTrip.deleteMany({ where: { userId: { in: targetIds } } }),
  ]);

  // 6) 계정 삭제 (세션·알림설정 등 나머지는 cascade)
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: { in: targetIds } } }),
    prisma.notificationSettings.deleteMany({ where: { userId: { in: targetIds } } }),
  ]);
  await prisma.user.deleteMany({ where: { id: { in: targetIds } } });

  return {
    deletedUsers: targetIds.length,
    deletedPosts: postCount,
    deletedMarketListings: listingCount,
    deletedGroups: groupCount,
    keptAdmins: adminIds.length,
  };
}
