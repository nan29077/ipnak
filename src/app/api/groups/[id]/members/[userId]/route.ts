import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { refundGroupJoin, rewardGroupLeaderOnApproval } from "@/lib/points";
import { isSqliteDb, toDbDate } from "@/lib/dbDate";

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// PATCH /api/groups/[id]/members/[userId] — role 변경 (approve → member, reject/remove → 삭제)
export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM \`Group\` WHERE \`id\` = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });
  if (group.leaderId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const [member] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM \`GroupMember\` WHERE \`groupId\` = ? AND \`userId\` = ?`, params.id, params.userId
  );
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

  const { action } = await req.json().catch(() => ({}));

  if (action === "approve") {
    // 승인 대기 상태가 아니면 승인할 수 없다 (반복 호출로 단장 적립이 중복되는 것 방지)
    if (member.role !== "pending")
      return NextResponse.json({ error: "승인 대기 중인 신청이 아닙니다." }, { status: 400 });
    await prisma.$executeRawUnsafe(
      `UPDATE \`GroupMember\` SET \`role\` = 'member' WHERE \`groupId\` = ? AND \`userId\` = ?`,
      params.id, params.userId
    );
    // 가입자가 1,000P를 차감했다면 단장에게 500P 적립 (유료 개설 ON 이었을 때)
    await rewardGroupLeaderOnApproval(params.userId, params.id, group.leaderId);
    // 승인 알림
    const notiId = createId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`Notification\` (\`id\`,\`userId\`,\`type\`,\`body\`,\`link\`,\`read\`,\`createdAt\`)
       VALUES (?,?,?,?,?,0,?)`,
      notiId, params.userId, "GROUP_JOIN_APPROVED",
      `[${group.name}] 낚시단 가입이 승인되었습니다.`,
      // createdAt — SQLite(dev)는 unix ms(정수), MariaDB(실서버) DATETIME은 "YYYY-MM-DD HH:MM:SS"
      `/groups/${params.id}`, isSqliteDb() ? Date.now() : toDbDate()
    );
    return NextResponse.json({ ok: true, action: "approved" });
  }

  if (action === "reject" || action === "remove") {
    const wasPending = member.role === "pending";
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`GroupMember\` WHERE \`groupId\` = ? AND \`userId\` = ?`, params.id, params.userId
    );
    if (wasPending) {
      // 가입 거절 → 차감했던 1,000P 환불
      await refundGroupJoin(params.userId, params.id);
      // 거절 알림
      const notiId = createId();
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`Notification\` (\`id\`,\`userId\`,\`type\`,\`body\`,\`link\`,\`read\`,\`createdAt\`)
         VALUES (?,?,?,?,?,0,?)`,
        notiId, params.userId, "GROUP_JOIN_REJECTED",
        `[${group.name}] 낚시단 가입신청이 거절되었습니다.`,
        // createdAt — SQLite(dev)는 unix ms(정수), MariaDB(실서버) DATETIME은 "YYYY-MM-DD HH:MM:SS"
        `/groups`, isSqliteDb() ? Date.now() : toDbDate()
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
      `UPDATE \`GroupMember\` SET \`role\` = ? WHERE \`groupId\` = ? AND \`userId\` = ?`,
      newRole, params.id, params.userId
    );
    return NextResponse.json({ ok: true, action: "promoted", newRole });
  }

  // transfer: 리더 양도
  if (action === "transfer") {
    if (member.role === "pending")
      return NextResponse.json({ error: "승인되지 않은 회원에게 양도할 수 없습니다." }, { status: 400 });
    // 세 개의 UPDATE를 트랜잭션으로 묶어 중간 실패 시 리더가 사라진 그룹이 생기지 않도록 보장
    try {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          `UPDATE \`Group\` SET \`leaderId\` = ? WHERE \`id\` = ?`, params.userId, params.id
        ),
        // 기존 리더 → member, 새 리더 → leader
        prisma.$executeRawUnsafe(
          `UPDATE \`GroupMember\` SET \`role\` = 'member' WHERE \`groupId\` = ? AND \`userId\` = ?`,
          params.id, user.id
        ),
        prisma.$executeRawUnsafe(
          `UPDATE \`GroupMember\` SET \`role\` = 'leader' WHERE \`groupId\` = ? AND \`userId\` = ?`,
          params.id, params.userId
        ),
      ]);
    } catch {
      return NextResponse.json({ error: "리더 양도 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "transferred" });
  }

  return NextResponse.json({ error: "잘못된 action입니다." }, { status: 400 });
}

// DELETE /api/groups/[id]/members/[userId] — 본인의 가입 신청 취소 (차감했던 1,000P 환불)
export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (params.userId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const [member] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM \`GroupMember\` WHERE \`groupId\` = ? AND \`userId\` = ?`, params.id, user.id
  );
  if (!member) return NextResponse.json({ error: "가입 신청 내역이 없습니다." }, { status: 404 });
  if (member.role !== "pending")
    return NextResponse.json({ error: "승인 대기 중인 신청만 취소할 수 있습니다." }, { status: 400 });

  // 차감했던 가입 비용 환불 후 신청 삭제
  await refundGroupJoin(user.id, params.id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`GroupMember\` WHERE \`groupId\` = ? AND \`userId\` = ?`, params.id, user.id
  );

  return NextResponse.json({ ok: true, action: "cancelled" });
}
