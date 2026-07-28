import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pointsEnabled, groupPointsRequired, getBalance, chargeGroupJoin, refundGroupJoin, POINT_RULES } from "@/lib/points";

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

  // 포인트 제도 OFF 이면 유료 개설 설정과 무관하게 포인트를 사용하지 않는다.
  // (가입 신청 자체는 그대로 이용 가능 — 차감 로직만 건너뛴다)
  // 최고관리자는 유료 개설이 켜져 있어도 포인트를 차감하지 않는다.
  const [enabled, requirePoints] = await Promise.all([pointsEnabled(), groupPointsRequired()]);
  const paidJoin = enabled && requirePoints && user.role !== "SUPER_ADMIN";

  // 낚시단 유료 개설 ON 이면 가입 신청 시 1,000P 차감 (거절 시 환불 / 승인 시 단장 500P 적립)
  if (paidJoin) {
    const bal = await getBalance(user.id);
    if (bal < POINT_RULES.GROUP_JOIN_COST)
      return NextResponse.json({ error: `가입 신청에는 ${POINT_RULES.GROUP_JOIN_COST.toLocaleString()}P가 필요합니다. (보유 ${bal.toLocaleString()}P)` }, { status: 400 });
  }

  // 가입 신청 비용 선차감 — 차감에 실패하면 신청을 등록하지 않는다(무료 가입 방지)
  if (paidJoin) {
    try {
      await chargeGroupJoin(user.id, params.id);
    } catch {
      return NextResponse.json({ error: "포인트가 부족합니다." }, { status: 400 });
    }
  }

  const memberId = createId();
  const now = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "GroupMember" ("id","groupId","userId","role","joinedAt") VALUES (?,?,?,?,?)`,
      memberId, params.id, user.id, "pending", now
    );
  } catch {
    // 신청 등록에 실패했다면 선차감한 가입 비용을 되돌린다
    if (paidJoin) await refundGroupJoin(user.id, params.id).catch(() => {});
    // throw 대신 정돈된 500 응답 (raw 500 방지)
    return NextResponse.json({ error: "가입 신청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 리더에게 알림 — 알림 실패가 이미 완료된 가입 신청을 500으로 만들지 않도록 보호
  try {
    const notiId = createId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Notification" ("id","userId","type","body","link","read","createdAt")
       VALUES (?,?,?,?,?,0,?)`,
      notiId, group.leaderId, "GROUP_JOIN_REQUEST",
      `${user.nickname}님이 [${group.name}] 낚시단 가입을 신청했습니다.`,
      `/groups/${params.id}/manage`, now
    );
  } catch { /* 알림 실패는 무시 */ }

  return NextResponse.json({ ok: true });
}
