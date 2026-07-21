import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { refundGroupJoin, rewardGroupLeaderOnApproval } from "@/lib/points";

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// PATCH /api/groups/[id]/members/[userId] — role 변경 (approve → member, reject/remove → 삭제)
export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Group" WHERE "id" = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });
  if (group.leaderId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const [member] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`, params.id, params.userId
  );
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

  const { action } = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (action === "approve") {
    await prisma.$executeRawUnsafe(
      `UPDATE "GroupMember" SET "role" = 'member' WHERE "groupId" = ? AND "userId" = ?`,
      params.id, params.userId
    );
    // 가입자가 1,000P를 차감했다면 단장에게 500P 적립 (유료 개설 ON 이었을 때)
    await rewardGroupLeaderOnApproval(params.userId, params.id, group.leaderId);
    // 승인 알림
    const notiId = createId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Notification" ("id","userId","type","body","link","read","createdAt")
       VALUES (?,?,?,?,?,0,?)`,
      notiId, params.userId, "GROUP_JOIN_APPROVED",
      `[${group.name}] 낚시단 가입이 승인되었습니다.`,
      `/groups/${params.id}`, now
    );
    return NextResponse.json({ ok: true, action: "approved" });
  }

  if (action === "reject" || action === "remove") {
    const wasPending = member.role === "pending";
    await prisma.$executeRawUnsafe(
      `DELETE FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`, params.id, params.userId
    );
    if (wasPending) {
      // 가입 거절 → 차감했던 1,000P 환불
      await refundGroupJoin(params.userId, params.id);
      // 거절 알림
      const notiId = createId();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Notification" ("id","userId","type","body","link","read","createdAt")
         VALUES (?,?,?,?,?,0,?)`,
        notiId, params.userId, "GROUP_JOIN_REJECTED",
        `[${group.name}] 낚시단 가입신청이 거절되었습니다.`,
        `/groups`, now
      );
    }
    return NextResponse.json({ ok: true, action });
  }

  // promote: 부리더 지정/해제 (토글)
  if (action === "promote") {
    if (member.role === "pending" || member.role === "leader")
      return NextResponse.json({ error: "부리더로 지정할 수 없는 회원입니다." }, { status: 400 });
    const newRole = member.role === "sub_leader" ? "member" : "sub_leader";
    await prisma.$executeRawUnsafe(
      `UPDATE "GroupMember" SET "role" = ? WHERE "groupId" = ? AND "userId" = ?`,
      newRole, params.id, params.userId
    );
    return NextResponse.json({ ok: true, action: "promoted", newRole });
  }

  // transfer: 리더 양도
  if (action === "transfer") {
    if (member.role === "pending")
      return NextResponse.json({ error: "승인되지 않은 회원에게 양도할 수 없습니다." }, { status: 400 });
    await prisma.$executeRawUnsafe(
      `UPDATE "Group" SET "leaderId" = ? WHERE "id" = ?`, params.userId, params.id
    );
    // 기존 리더 → member, 새 리더 → leader
    await prisma.$executeRawUnsafe(
      `UPDATE "GroupMember" SET "role" = 'member' WHERE "groupId" = ? AND "userId" = ?`,
      params.id, user.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "GroupMember" SET "role" = 'leader' WHERE "groupId" = ? AND "userId" = ?`,
      params.id, params.userId
    );
    return NextResponse.json({ ok: true, action: "transferred" });
  }

  return NextResponse.json({ error: "잘못된 action입니다." }, { status: 400 });
}
