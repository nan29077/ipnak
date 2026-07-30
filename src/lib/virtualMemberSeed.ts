import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildVirtualMemberPlan, VIRTUAL_EMAIL_DOMAIN } from "@/lib/virtualMembers";
import { groupPostTablesExist, ignoreMissingTable } from "@/lib/dataReset";

// 가상회원 계정 생성·삭제. 계정은 일반 ANGLER 회원과 같은 구조로 만들고,
// VirtualMember 행으로만 "가상회원"임을 구분한다. 프로필 이미지는 저장하지 않고
// avatarUtils.getAvatarUrl 의 userId 기반 캐릭터 스티커 폴백을 그대로 활용한다.
//
// 관리자 API(/api/admin/virtual)와 CLI 스크립트(prisma/seed-virtual-members.ts)가 같은 함수를 쓰도록
// "server-only" 는 붙이지 않는다. Prisma 를 직접 쓰므로 클라이언트 번들에 들어가면 빌드가 실패한다.

// 로그인 용도가 아니라 데이터 정합성을 위한 비밀번호. 노출되어도 의미가 없도록 매번 랜덤 솔트로 해시한다.
const VIRTUAL_PASSWORD = "IpnakVirtual!2026";

export type VirtualSeedSummary = { created: number; updated: number; total: number };

/**
 * 지역·성격 분배 계획대로 가상회원 100명을 생성한다.
 * 이미 있는 계정은 닉네임·지역·자기소개만 계획에 맞춰 갱신하므로 여러 번 실행해도 안전하다.
 */
export async function seedVirtualMembers(): Promise<VirtualSeedSummary> {
  const plan = buildVirtualMemberPlan();
  const passwordHash = await bcrypt.hash(VIRTUAL_PASSWORD, 10);

  let created = 0;
  let updated = 0;

  for (const p of plan) {
    const existing = await prisma.user.findUnique({ where: { email: p.email }, select: { id: true } });

    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { nickname: p.nickname, region: p.region, bio: p.bio },
      create: {
        email: p.email,
        passwordHash,
        nickname: p.nickname,
        role: "ANGLER",
        region: p.region,
        bio: p.bio,
        // avatarUrl 은 비워 둔다 — 앱 공용 캐릭터 스티커 아바타가 userId 기준으로 배정된다.
        avatarUrl: null,
      },
    });

    await prisma.virtualMember.upsert({
      where: { userId: user.id },
      update: { personality: p.personality, regionGroup: p.regionGroup },
      create: {
        userId: user.id,
        personality: p.personality,
        regionGroup: p.regionGroup,
      },
    });

    if (existing) updated++;
    else created++;
  }

  const total = await prisma.virtualMember.count();
  return { created, updated, total };
}

export type VirtualResetSummary = {
  deletedMembers: number;
  deletedPosts: number;
  deletedComments: number;
  deletedMarketListings: number;
};

/**
 * 가상회원 전체와 그들이 만든 콘텐츠를 삭제한다.
 * 가상회원 계정에 딸린 데이터만 지우므로 실제 회원·관리자 콘텐츠에는 영향이 없다.
 */
export async function resetVirtualMembers(): Promise<VirtualResetSummary> {
  const members = await prisma.virtualMember.findMany({ select: { userId: true } });
  const userIds = members.map((m) => m.userId);

  // VirtualMember 행이 지워졌지만 계정만 남은 경우까지 함께 정리한다.
  const orphans = await prisma.user.findMany({
    where: { email: { endsWith: `@${VIRTUAL_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const ids = Array.from(new Set([...userIds, ...orphans.map((o) => o.id)]));

  if (ids.length === 0) {
    return { deletedMembers: 0, deletedPosts: 0, deletedComments: 0, deletedMarketListings: 0 };
  }

  const [postCount, commentCount, listingCount] = await Promise.all([
    prisma.post.count({ where: { authorId: { in: ids } } }),
    prisma.comment.count({ where: { authorId: { in: ids } } }),
    prisma.marketListing.count({ where: { sellerId: { in: ids } } }),
  ]);

  const listings = await prisma.marketListing.findMany({ where: { sellerId: { in: ids } }, select: { id: true } });
  const listingIds = listings.map((l) => l.id);

  await prisma.$transaction([
    prisma.marketMessage.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { chat: { listingId: { in: listingIds } } }] } }),
    prisma.marketChat.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { listingId: { in: listingIds } }] } }),
    prisma.marketFavorite.deleteMany({ where: { OR: [{ userId: { in: ids } }, { listingId: { in: listingIds } }] } }),
    prisma.marketImage.deleteMany({ where: { listingId: { in: listingIds } } }),
    prisma.marketListing.deleteMany({ where: { id: { in: listingIds } } }),
  ]);

  await prisma.$transaction([
    prisma.postProductTag.deleteMany({ where: { post: { authorId: { in: ids } } } }),
    prisma.postImage.deleteMany({ where: { post: { authorId: { in: ids } } } }),
    prisma.curationFeature.deleteMany({ where: { post: { authorId: { in: ids } } } }),
    prisma.bookmark.deleteMany({ where: { OR: [{ userId: { in: ids } }, { post: { authorId: { in: ids } } }] } }),
    prisma.like.deleteMany({ where: { OR: [{ userId: { in: ids } }, { post: { authorId: { in: ids } } }] } }),
    prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { post: { authorId: { in: ids } } }] } }),
    prisma.shareEvent.deleteMany({ where: { OR: [{ userId: { in: ids } }, { post: { authorId: { in: ids } } }] } }),
    prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: ids } }, { post: { authorId: { in: ids } } }] } }),
  ]);
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } });

  // 낚시단 커뮤니티 게시글 테이블은 DB 미반영일 수 있어 존재할 때만 정리한다.
  if (await groupPostTablesExist()) {
    await ignoreMissingTable(() => prisma.groupPostLike.deleteMany({ where: { userId: { in: ids } } }));
    await ignoreMissingTable(() => prisma.groupComment.deleteMany({ where: { authorId: { in: ids } } }));
    await ignoreMissingTable(() => prisma.groupPost.deleteMany({ where: { authorId: { in: ids } } }));
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { actorId: { in: ids } }] } }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: ids } }, { followingId: { in: ids } }] } }),
    prisma.groupMember.deleteMany({ where: { userId: { in: ids } } }),
    prisma.session.deleteMany({ where: { userId: { in: ids } } }),
    prisma.notificationSettings.deleteMany({ where: { userId: { in: ids } } }),
    prisma.virtualActivity.deleteMany({ where: { member: { userId: { in: ids } } } }),
  ]);

  await prisma.virtualMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  return {
    deletedMembers: ids.length,
    deletedPosts: postCount,
    deletedComments: commentCount,
    deletedMarketListings: listingCount,
  };
}
