import "server-only";
import { prisma } from "./prisma";
import { getBoolSetting } from "./settings";

// ===== 포인트 제도 규칙 상수 =====
export const POINT_RULES = {
  POST_REWARD: 100, // 피드 글 작성 시 적립
  POST_DAILY_LIMIT: 5, // 하루 최대 적립 횟수(피싱·일상·조행기·스마트피싱·워킹 피드 합산)
  COMMENT_REWARD: 10, // 댓글 작성 시 적립
  COMMENT_DAILY_LIMIT: 20, // 하루 최대 댓글 적립 횟수(일반 댓글·낚시단 댓글 합산)
  WALKING_UNLOCK_COST: 200, // 워킹 피드 열람 차감
  WALKING_AUTHOR_REWARD: 100, // 열람 시 작성자 적립
  GROUP_CREATE_COST: 10000, // 낚시단 개설 차감(유료 개설 ON)
  GROUP_JOIN_COST: 1000, // 낚시단 가입 신청 차감(유료 개설 ON)
  GROUP_JOIN_LEADER_REWARD: 500, // 가입 승인 시 단장 적립
  WON_PER_POINT: 1, // 1원 = 1포인트 (10,000원 = 10,000P)
} as const;

export type PointTxType =
  | "EARN"
  | "SPEND"
  | "CHARGE"
  | "GIFT_SENT"
  | "GIFT_RECEIVED"
  | "ADMIN"
  | "REFUND";

/**
 * 포인트 거래의 발생 지점(source).
 * SQLite 는 Prisma enum 을 지원하지 않으므로 PointTransaction.source 는 String? 로 두고
 * 여기의 유니온 타입을 단일 기준으로 삼는다.
 * ⚠️ 기존 값은 절대 변경하지 말고 새 값만 아래에 추가한다(과거 거래 내역이 문자열로 저장돼 있음).
 */
export const POINT_SOURCES = [
  "POST", // 피드 글 작성 적립
  "COMMENT", // 댓글 작성 적립
  "SHOPPING", // 쇼핑 결제에 포인트 사용
  "IPNAK_BALL", // 입낚볼 구입에 포인트 사용
  "IPNAK_KEYRING", // 입낚키링 구입에 포인트 사용
] as const;

export type PointSource = (typeof POINT_SOURCES)[number];

/** 포인트를 사용해 결제할 수 있는 상품군 */
export const SPEND_SOURCE_LABELS: Record<"SHOPPING" | "IPNAK_BALL" | "IPNAK_KEYRING", string> = {
  SHOPPING: "쇼핑 결제",
  IPNAK_BALL: "입낚볼 구입",
  IPNAK_KEYRING: "입낚키링 구입",
};

export const TX_LABELS: Record<PointTxType, string> = {
  EARN: "적립",
  SPEND: "사용",
  CHARGE: "충전",
  GIFT_SENT: "선물 보냄",
  GIFT_RECEIVED: "선물 받음",
  ADMIN: "관리자 지급",
  REFUND: "환불",
};

export async function pointsEnabled(): Promise<boolean> {
  return getBoolSetting("points_enabled");
}
export async function groupPointsRequired(): Promise<boolean> {
  return getBoolSetting("group_points_required");
}

export async function getBalance(userId: string): Promise<number> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    return (u as any)?.points ?? 0;
  } catch {
    return 0;
  }
}

// KST(UTC+9) 기준 오늘 0시의 UTC Date
function kstDayStart(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000);
}

type Related = { userId?: string | null; postId?: string | null };

/**
 * 트랜잭션 내부에서 한 회원의 포인트를 증감하고 내역을 기록한다.
 * amount 는 부호 포함(+적립/-사용). 잔액이 음수가 되면 INSUFFICIENT_POINTS throw.
 * source 는 선택 — 넘기지 않으면 기존과 동일하게 null 로 기록된다.
 */
export async function applyPoints(
  tx: any,
  userId: string,
  amount: number,
  type: PointTxType,
  description: string,
  related?: Related,
  source?: PointSource | null,
): Promise<number> {
  const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw new Error("USER_NOT_FOUND");
  // 원자적 증감: 읽기-쓰기 race condition 방지
  const updated = await tx.user.update({
    where: { id: userId },
    data: { points: { increment: amount } },
    select: { points: true },
  });
  const next = updated.points ?? 0;
  if (next < 0) throw new Error("INSUFFICIENT_POINTS");
  await tx.pointTransaction.create({
    data: {
      userId,
      type,
      amount,
      balanceAfter: next,
      description,
      relatedUserId: related?.userId ?? null,
      relatedPostId: related?.postId ?? null,
      source: source ?? null,
    },
  });
  return next;
}

/** 단일 회원 포인트 증감(자체 트랜잭션). 잔액 부족 시 throw. */
export async function changePoints(
  userId: string,
  amount: number,
  type: PointTxType,
  description: string,
  related?: Related,
  source?: PointSource | null,
): Promise<number> {
  return prisma.$transaction((tx) => applyPoints(tx, userId, amount, type, description, related, source));
}

/**
 * 오늘(KST) 이미 지급된 "글 작성 적립" 건수.
 * 종류(피싱 피드·일상 피드·조행기·스마트피싱 계측·워킹 피드)와 무관하게 하나의 버킷으로 합산한다.
 * 카운트 조건: type=EARN & relatedPostId 존재 & relatedUserId 없음
 *  - 워킹 피드 열람 적립은 relatedUserId(열람자)가 있어 제외된다.
 *  - 댓글 적립은 relatedPostId 를 남기지 않아(=null) 제외된다.
 */
async function countPostRewardsToday(userId: string): Promise<number> {
  const since = kstDayStart();
  return prisma.pointTransaction.count({
    where: { userId, type: "EARN", relatedUserId: null, relatedPostId: { not: null }, createdAt: { gte: since } },
  });
}

/** 피드 글 작성 적립 — 하루 5회 한도. 포인트 제도 OFF 이면 무동작. */
export async function awardPostReward(userId: string, postId: string): Promise<number | null> {
  try {
    if (!(await pointsEnabled())) return null;
    const count = await countPostRewardsToday(userId);
    if (count >= POINT_RULES.POST_DAILY_LIMIT) return null;
    await changePoints(userId, POINT_RULES.POST_REWARD, "EARN", "피드 글 작성 적립", { postId }, "POST");
    return POINT_RULES.POST_REWARD;
  } catch {
    return null;
  }
}

/** 오늘 남은 글 작성 적립 횟수 */
export async function remainingPostRewards(userId: string): Promise<number> {
  try {
    return Math.max(0, POINT_RULES.POST_DAILY_LIMIT - (await countPostRewardsToday(userId)));
  } catch {
    return POINT_RULES.POST_DAILY_LIMIT;
  }
}

/** 글쓰기 화면 안내 문구용 — 오늘 사용한/전체 적립 횟수 */
export async function postRewardStatus(
  userId: string,
): Promise<{ enabled: boolean; used: number; limit: number; reward: number }> {
  const limit = POINT_RULES.POST_DAILY_LIMIT;
  const reward = POINT_RULES.POST_REWARD;
  try {
    const [enabled, used] = await Promise.all([pointsEnabled(), countPostRewardsToday(userId)]);
    return { enabled, used: Math.min(used, limit), limit, reward };
  } catch {
    return { enabled: false, used: 0, limit, reward };
  }
}

/**
 * 오늘(KST) 이미 지급된 "댓글 작성 적립" 건수.
 * 종류(일반 댓글·낚시단 댓글)와 무관하게 source="COMMENT" 하나의 버킷으로 합산한다.
 * 글 작성 적립(source="POST")과는 버킷이 완전히 분리된다.
 */
async function countCommentRewardsToday(userId: string): Promise<number> {
  const since = kstDayStart();
  return prisma.pointTransaction.count({
    where: { userId, type: "EARN", source: "COMMENT", createdAt: { gte: since } },
  });
}

/** 적립 현황 그래프용 — 오늘 사용한/전체 댓글 적립 횟수 (postRewardStatus 와 같은 형태) */
export async function commentRewardStatus(
  userId: string,
): Promise<{ enabled: boolean; used: number; limit: number; reward: number }> {
  const limit = POINT_RULES.COMMENT_DAILY_LIMIT;
  const reward = POINT_RULES.COMMENT_REWARD;
  try {
    const [enabled, used] = await Promise.all([pointsEnabled(), countCommentRewardsToday(userId)]);
    return { enabled, used: Math.min(used, limit), limit, reward };
  } catch {
    return { enabled: false, used: 0, limit, reward };
  }
}

/**
 * 댓글 작성 적립 — 종류(일반 댓글·낚시단 댓글) 무관 +10P, 하루 20회 한도.
 * 포인트 제도 OFF 이거나 오늘 한도를 다 썼으면 무동작(null).
 * 실패해도 댓글 등록 자체는 성공 처리하도록 예외를 삼킨다.
 * ⚠️ relatedPostId 를 남기지 않는다 — 남기면 글 작성 하루 5회 한도 카운트에 섞인다.
 */
export async function awardCommentReward(userId: string): Promise<number | null> {
  try {
    if (!(await pointsEnabled())) return null;
    const count = await countCommentRewardsToday(userId);
    if (count >= POINT_RULES.COMMENT_DAILY_LIMIT) return null;
    await changePoints(userId, POINT_RULES.COMMENT_REWARD, "EARN", "댓글 작성 적립", undefined, "COMMENT");
    return POINT_RULES.COMMENT_REWARD;
  } catch {
    return null;
  }
}

/**
 * 상품 결제에 포인트를 사용(차감)한다.
 * - amount 는 1 이상의 정수만 허용 (INVALID_AMOUNT)
 * - 잔액이 모자라면 applyPoints 에서 INSUFFICIENT_POINTS throw → 트랜잭션 롤백(음수 잔액 불가)
 * 호출부는 결제/주문 생성이 실패하면 refundSpentPoints 로 되돌려야 한다.
 */
export async function spendPoints(
  userId: string,
  amount: number,
  source: "SHOPPING" | "IPNAK_BALL" | "IPNAK_KEYRING",
  memo?: string,
): Promise<number> {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("INVALID_AMOUNT");
  const label = SPEND_SOURCE_LABELS[source];
  const desc = memo?.trim() ? `${label} · ${memo.trim()}` : label;
  return changePoints(userId, -amt, "SPEND", desc, undefined, source);
}

/** 결제·주문 생성이 실패했을 때 spendPoints 로 차감한 포인트를 원복한다. */
export async function refundSpentPoints(
  userId: string,
  amount: number,
  source: "SHOPPING" | "IPNAK_BALL" | "IPNAK_KEYRING",
) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return;
  try {
    await changePoints(userId, amt, "REFUND", `${SPEND_SOURCE_LABELS[source]} 취소 환불`, undefined, source);
  } catch {
    /* noop */
  }
}

/**
 * 클라이언트가 보낸 "사용할 포인트"를 서버 기준으로 안전하게 보정한다.
 * 보유 포인트 이내 · 결제금액 이하 · 0 이상의 정수로 클램프한다.
 * 포인트 제도가 꺼져 있으면 항상 0.
 */
export async function resolveUsablePoints(userId: string, requested: unknown, totalAmount: number): Promise<number> {
  const want = Math.floor(Number(requested));
  if (!Number.isFinite(want) || want <= 0) return 0;
  if (!(await pointsEnabled())) return 0;
  const balance = await getBalance(userId);
  return Math.max(0, Math.min(want, balance, Math.max(0, Math.floor(totalAmount))));
}

/** 특정 회원이 이미 열람한 워킹 피드 postId 집합 */
export async function walkingUnlockedSet(userId: string | undefined, postIds: string[]): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  try {
    const rows = await prisma.walkingFeedUnlock.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(rows.map((r) => r.postId));
  } catch {
    return new Set();
  }
}

export type UnlockResult = { ok: boolean; alreadyUnlocked?: boolean; balance?: number };

/** 워킹 피드 열람 잠금 해제: 200P 차감 → 작성자에게 100P 적립. */
export async function unlockWalkingFeed(userId: string, postId: string): Promise<UnlockResult> {
  if (!(await pointsEnabled())) return { ok: true, alreadyUnlocked: true };
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, postType: true } });
  if (!post || post.postType !== "WALKING_FEED") throw new Error("NOT_WALKING_FEED");
  if (post.authorId === userId) return { ok: true, alreadyUnlocked: true };
  const existing = await prisma.walkingFeedUnlock.findUnique({ where: { userId_postId: { userId, postId } } });
  if (existing) return { ok: true, alreadyUnlocked: true };

  return prisma.$transaction(async (tx) => {
    const already = await tx.walkingFeedUnlock.findUnique({ where: { userId_postId: { userId, postId } } });
    if (already) return { ok: true, alreadyUnlocked: true };
    const balance = await applyPoints(tx, userId, -POINT_RULES.WALKING_UNLOCK_COST, "SPEND", "워킹 피드 열람", { postId });
    await tx.walkingFeedUnlock.create({ data: { userId, postId } });
    // 작성자 적립 — relatedUserId=열람자 로 구분(글 작성 적립 카운트에서 제외)
    await applyPoints(tx, post.authorId, POINT_RULES.WALKING_AUTHOR_REWARD, "EARN", "내 워킹 피드 열람 적립", {
      userId,
      postId,
    });
    return { ok: true, balance };
  });
}

/** 친구에게 포인트 선물 (닉네임 또는 이메일로 대상 지정) */
export async function giftPoints(fromUserId: string, toIdentifier: string, amount: number) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("INVALID_AMOUNT");
  const ident = String(toIdentifier || "").trim();
  if (!ident) throw new Error("USER_NOT_FOUND");

  // 이메일이면 이메일로만, 닉네임이면 닉네임으로만 검색 (중복 닉네임 오전송 방지)
  const isEmail = ident.includes("@");
  let to;
  if (isEmail) {
    to = await prisma.user.findUnique({ where: { email: ident } });
  } else {
    const candidates = await prisma.user.findMany({
      where: { nickname: ident },
      select: { id: true, nickname: true, email: true },
    });
    if (candidates.length > 1) throw new Error("DUPLICATE_NICKNAME");
    to = candidates[0] ?? null;
  }
  if (!to) throw new Error("USER_NOT_FOUND");
  if (to.id === fromUserId) throw new Error("SELF_GIFT");
  const fromUser = await prisma.user.findUnique({ where: { id: fromUserId }, select: { nickname: true } });

  return prisma.$transaction(async (tx) => {
    const balance = await applyPoints(tx, fromUserId, -amt, "GIFT_SENT", `${to.nickname}님에게 선물`, { userId: to.id });
    await applyPoints(tx, to.id, amt, "GIFT_RECEIVED", `${fromUser?.nickname ?? "회원"}님의 선물`, { userId: fromUserId });
    return { ok: true, balance, toNickname: to.nickname };
  });
}

/** 포인트 충전 (PG 연동은 추후 — 현재 mock 승인) */
export async function chargePoints(userId: string, amount: number) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("INVALID_AMOUNT");
  const balance = await changePoints(userId, amt, "CHARGE", `포인트 충전 ${amt.toLocaleString()}P`);
  return { ok: true, balance };
}

/** 관리자 임의 지급/차감 */
export async function adminTopup(adminId: string, userId: string, amount: number, memo?: string) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt === 0) throw new Error("INVALID_AMOUNT");
  const desc = memo?.trim() ? `관리자 지급 · ${memo.trim()}` : "관리자 지급";
  const balance = await changePoints(userId, amt, "ADMIN", desc, { userId: adminId });
  return { ok: true, balance };
}

// ===== 낚시단(그룹) 유료 개설/가입 정산 =====

/** 낚시단 가입 신청 시 1,000P 차감(유료 개설 ON). related=낚시단 id */
export async function chargeGroupJoin(userId: string, groupId: string) {
  return changePoints(userId, -POINT_RULES.GROUP_JOIN_COST, "SPEND", "낚시단 가입 신청", { postId: groupId });
}

/** 낚시단 개설 시 10,000P 차감(유료 개설 ON). related=낚시단 id */
export async function chargeGroupCreate(userId: string, groupId: string) {
  return changePoints(userId, -POINT_RULES.GROUP_CREATE_COST, "SPEND", "낚시단 개설", { postId: groupId });
}

// 해당 회원이 이 낚시단에 대해 아직 환불되지 않은 가입 차감이 있는지
async function hasUnrefundedJoinCharge(userId: string, groupId: string): Promise<boolean> {
  try {
    const [spends, refunds] = await Promise.all([
      prisma.pointTransaction.count({ where: { userId, type: "SPEND", relatedPostId: groupId, description: "낚시단 가입 신청" } }),
      prisma.pointTransaction.count({ where: { userId, type: "REFUND", relatedPostId: groupId, description: "낚시단 가입 거절 환불" } }),
    ]);
    return spends > refunds;
  } catch {
    return false;
  }
}

/** 낚시단 개설이 실패했을 때 선차감한 10,000P 원복 */
export async function refundGroupCreate(userId: string, groupId: string) {
  try {
    await changePoints(userId, POINT_RULES.GROUP_CREATE_COST, "REFUND", "낚시단 개설 취소 환불", { postId: groupId });
  } catch {
    /* noop */
  }
}

/** 가입 거절/신청 취소 시 차감했던 1,000P 환불(차감 이력이 있을 때만) */
export async function refundGroupJoin(userId: string, groupId: string) {
  try {
    if (!(await hasUnrefundedJoinCharge(userId, groupId))) return;
    await changePoints(userId, POINT_RULES.GROUP_JOIN_COST, "REFUND", "낚시단 가입 거절 환불", { postId: groupId });
  } catch {
    /* noop */
  }
}

/** 가입 승인 시 단장에게 500P 적립(가입자가 실제로 차감했을 때만) */
export async function rewardGroupLeaderOnApproval(memberUserId: string, groupId: string, leaderId: string) {
  try {
    if (!(await hasUnrefundedJoinCharge(memberUserId, groupId))) return;
    await changePoints(leaderId, POINT_RULES.GROUP_JOIN_LEADER_REWARD, "EARN", "낚시단 가입 승인 적립", {
      userId: memberUserId,
      postId: groupId,
    });
  } catch {
    /* noop */
  }
}
