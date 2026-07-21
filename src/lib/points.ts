import "server-only";
import { prisma } from "./prisma";
import { getBoolSetting } from "./settings";

// ===== 포인트 제도 규칙 상수 =====
export const POINT_RULES = {
  POST_REWARD: 100, // 피드 글 작성 시 적립
  POST_DAILY_LIMIT: 5, // 하루 최대 적립 횟수
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
 */
export async function applyPoints(
  tx: any,
  userId: string,
  amount: number,
  type: PointTxType,
  description: string,
  related?: Related,
): Promise<number> {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
  if (!u) throw new Error("USER_NOT_FOUND");
  const next = (u.points ?? 0) + amount;
  if (next < 0) throw new Error("INSUFFICIENT_POINTS");
  await tx.user.update({ where: { id: userId }, data: { points: next } });
  await tx.pointTransaction.create({
    data: {
      userId,
      type,
      amount,
      balanceAfter: next,
      description,
      relatedUserId: related?.userId ?? null,
      relatedPostId: related?.postId ?? null,
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
): Promise<number> {
  return prisma.$transaction((tx) => applyPoints(tx, userId, amount, type, description, related));
}

/** 피드 글 작성 적립 — 하루 5회 한도. 포인트 제도 OFF 이면 무동작. */
export async function awardPostReward(userId: string, postId: string): Promise<number | null> {
  try {
    if (!(await pointsEnabled())) return null;
    const since = kstDayStart();
    // 글 작성 적립만 카운트: type=EARN & relatedPostId 존재 & relatedUserId 없음(열람 적립은 relatedUserId 있음)
    const count = await prisma.pointTransaction.count({
      where: { userId, type: "EARN", relatedUserId: null, relatedPostId: { not: null }, createdAt: { gte: since } },
    });
    if (count >= POINT_RULES.POST_DAILY_LIMIT) return null;
    await changePoints(userId, POINT_RULES.POST_REWARD, "EARN", "피드 글 작성 적립", { postId });
    return POINT_RULES.POST_REWARD;
  } catch {
    return null;
  }
}

/** 오늘 남은 글 작성 적립 횟수 */
export async function remainingPostRewards(userId: string): Promise<number> {
  try {
    const since = kstDayStart();
    const count = await prisma.pointTransaction.count({
      where: { userId, type: "EARN", relatedUserId: null, relatedPostId: { not: null }, createdAt: { gte: since } },
    });
    return Math.max(0, POINT_RULES.POST_DAILY_LIMIT - count);
  } catch {
    return POINT_RULES.POST_DAILY_LIMIT;
  }
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
  const to = await prisma.user.findFirst({
    where: { OR: [{ email: ident }, { nickname: ident }] },
  });
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

/** 가입 거절 시 차감했던 1,000P 환불(차감 이력이 있을 때만) */
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
