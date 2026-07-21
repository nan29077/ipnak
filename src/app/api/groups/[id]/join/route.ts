import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { groupPointsRequired, getBalance, chargeGroupJoin, POINT_RULES } from "@/lib/points";

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// POST /api/groups/[id]/join
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Group" WHERE "id" = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });

  const [existing] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`, params.id, user.id
  );
  if (existing) return NextResponse.json({ error: "이미 가입신청했거나 회원입니다." }, { status: 409 });

  // 낚시단 유료 개설 ON 이면 가입 신청 시 1,000P 차감 (거절 시 환불 / 승인 시 단장 500P 적립)
  const paidJoin = await groupPointsRequired();
  if (paidJoin) {
    const bal = await getBalance(user.id);
    if (bal < POINT_RULES.GROUP_JOIN_COST)
      return NextResponse.json({ error: `가입 신청에는 ${POINT_RULES.GROUP_JOIN_COST.toLocaleString()}P가 필요합니다. (보유 ${bal.toLocaleString()}P)` }, { status: 400 });
  }

  const memberId = createId();
  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GroupMember" ("id","groupId","userId","role","joinedAt") VALUES (?,?,?,?,?)`,
    memberId, params.id, user.id, "pending", now
  );

  // 가입 신청 비용 차감 (유료 개설 ON)
  if (paidJoin) {
    try { await chargeGroupJoin(user.id, params.id); } catch { /* 잔액 확인 통과 */ }
  }

  // 리더에게 알림
  const notiId = createId();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Notification" ("id","userId","type","body","link","read","createdAt")
     VALUES (?,?,?,?,?,0,?)`,
    notiId, group.leaderId, "GROUP_JOIN_REQUEST",
    `${user.nickname}님이 [${group.name}] 낚시단 가입을 신청했습니다.`,
    `/groups/${params.id}/manage`, now
  );

  return NextResponse.json({ ok: true });
}
