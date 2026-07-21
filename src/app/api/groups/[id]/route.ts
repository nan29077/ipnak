import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/groups/[id] — myRole 포함 (null | "pending" | "member" | "sub_leader" | "leader")
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, u."nickname" as "leaderNickname", u."avatarUrl" as "leaderAvatar",
            COUNT(m."id") as "memberCount"
     FROM "Group" g
     LEFT JOIN "User" u ON u."id" = g."leaderId"
     LEFT JOIN "GroupMember" m ON m."groupId" = g."id" AND m."role" IN ('leader','sub_leader','member')
     WHERE g."id" = ?
     GROUP BY g."id"`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });

  // 현재 유저 멤버십 상태
  let myRole: string | null = null;
  if (user) {
    const [mem] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "role" FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`,
      params.id, user.id
    );
    myRole = mem?.role ?? null;
  }

  return NextResponse.json({ group: { ...normalizeGroup(group), myRole } });
}

// PATCH /api/groups/[id] — 리더만 낚시단 정보 수정
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Group" WHERE "id" = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });
  if (group.leaderId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, description, category, region, fishSpecies, tags, imageUrl } = body;
  const now = new Date().toISOString();

  await prisma.$executeRawUnsafe(
    `UPDATE "Group" SET "name"=?, "description"=?, "category"=?, "region"=?, "fishSpecies"=?, "tags"=?, "imageUrl"=?, "updatedAt"=? WHERE "id"=?`,
    name || group.name,
    description ?? group.description,
    category || group.category,
    region ?? group.region,
    fishSpecies ?? group.fishSpecies,
    tags ? JSON.stringify(tags) : group.tags,
    imageUrl ?? group.imageUrl,
    now, params.id
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id] — 리더만 낚시단 해산
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Group" WHERE "id" = ?`, params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });
  if (group.leaderId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // 멤버 먼저 삭제 후 그룹 삭제
  await prisma.$executeRawUnsafe(`DELETE FROM "GroupMember" WHERE "groupId" = ?`, params.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "Group" WHERE "id" = ?`, params.id);

  return NextResponse.json({ ok: true });
}

function normalizeGroup(g: any) {
  return { ...g, isPublic: g.isPublic === 1 || g.isPublic === true, memberCount: Number(g.memberCount ?? 0), tags: g.tags ? tryParse(g.tags) : [] };
}
function tryParse(s: string) { try { return JSON.parse(s); } catch { return []; } }
