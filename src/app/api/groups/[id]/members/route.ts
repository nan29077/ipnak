import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/groups/[id]/members — 리더는 전체 목록(role/email 포함), 일반 회원은 승인된 회원 목록만(role/email 미포함)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Group" WHERE "id" = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });

  const isLeader = group.leaderId === user.id;

  if (!isLeader) {
    // 승인된 회원만 열람 가능 — 민감 정보(role/email) 제외
    const [mem] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "role" FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`,
      params.id, user.id
    );
    const myRole = mem?.role ?? null;
    if (!["leader", "sub_leader", "member"].includes(myRole)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const members = await prisma.$queryRawUnsafe<any[]>(
      `SELECT m."id", m."userId", m."joinedAt", u."nickname", u."avatarUrl"
       FROM "GroupMember" m
       LEFT JOIN "User" u ON u."id" = m."userId"
       WHERE m."groupId" = ? AND m."role" IN ('leader','sub_leader','member')
       ORDER BY CASE m."role" WHEN 'leader' THEN 0 WHEN 'sub_leader' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, m."joinedAt" ASC`,
      params.id
    );

    return NextResponse.json({ members });
  }

  const members = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.*, u."nickname", u."avatarUrl", u."email"
     FROM "GroupMember" m
     LEFT JOIN "User" u ON u."id" = m."userId"
     WHERE m."groupId" = ?
     ORDER BY CASE m."role" WHEN 'leader' THEN 0 WHEN 'sub_leader' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, m."joinedAt" ASC`,
    params.id
  );

  return NextResponse.json({ members });
}
