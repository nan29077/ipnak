import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { groupPointsRequired, getBalance, chargeGroupCreate, POINT_RULES } from "@/lib/points";

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// GET /api/groups
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "";
  const fishSpecies = searchParams.get("fishSpecies") || "";
  const search = searchParams.get("search") || "";

  let where = `WHERE g."isPublic" = 1`;
  const params: unknown[] = [];

  if (region) { params.push(`%${region}%`); where += ` AND g."region" LIKE ?`; }
  if (fishSpecies) { params.push(`%${fishSpecies}%`); where += ` AND g."fishSpecies" LIKE ?`; }
  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where += ` AND (g."name" LIKE ? OR g."description" LIKE ?)`;
  }

  const groups = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, u."nickname" as "leaderNickname", u."avatarUrl" as "leaderAvatar",
            COUNT(m."id") as "memberCount"
     FROM "Group" g
     LEFT JOIN "User" u ON u."id" = g."leaderId"
     LEFT JOIN "GroupMember" m ON m."groupId" = g."id" AND m."role" IN ('leader','sub_leader','member')
     ${where}
     GROUP BY g."id"
     ORDER BY g."createdAt" DESC
     LIMIT 50`,
    ...params
  );

  // 현재 유저의 각 그룹 멤버십 상태
  let myRoles: Record<string, string> = {};
  if (user) {
    const memberships = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "groupId", "role" FROM "GroupMember" WHERE "userId" = ?`, user.id
    );
    myRoles = Object.fromEntries(memberships.map(m => [m.groupId, m.role]));
  }

  return NextResponse.json({ groups: groups.map(g => ({ ...normalizeGroup(g), myRole: myRoles[g.id] ?? null })) });
}

// POST /api/groups
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, description, category, region, fishSpecies, tags, isPublic, imageUrl } = body;
  if (!name?.trim() || !category?.trim())
    return NextResponse.json({ error: "이름과 카테고리는 필수입니다." }, { status: 400 });

  // 낚시단 유료 개설 ON 이면 10,000P 필요 — 개설 전 잔액 확인
  const paidCreate = await groupPointsRequired();
  if (paidCreate) {
    const bal = await getBalance(user.id);
    if (bal < POINT_RULES.GROUP_CREATE_COST)
      return NextResponse.json({ error: `낚시단 개설에는 ${POINT_RULES.GROUP_CREATE_COST.toLocaleString()}P가 필요합니다. (보유 ${bal.toLocaleString()}P)` }, { status: 400 });
  }

  const id = createId();
  const now = new Date().toISOString();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Group" ("id","name","description","leaderId","category","region","fishSpecies","tags","isPublic","imageUrl","createdAt","updatedAt")
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, name.trim(), description || null, user.id, category.trim(),
    region || null, fishSpecies || null,
    tags ? JSON.stringify(tags) : null,
    isPublic !== false ? 1 : 0,
    imageUrl || null, now, now
  );

  const memberId = createId();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GroupMember" ("id","groupId","userId","role","joinedAt") VALUES (?,?,?,?,?)`,
    memberId, id, user.id, "leader", now
  );

  // 개설 비용 차감 (유료 개설 ON)
  if (paidCreate) {
    try { await chargeGroupCreate(user.id, id); } catch { /* 잔액 확인을 통과했으므로 실패 가능성 낮음 */ }
  }

  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, u."nickname" as "leaderNickname", u."avatarUrl" as "leaderAvatar", 1 as "memberCount"
     FROM "Group" g LEFT JOIN "User" u ON u."id" = g."leaderId"
     WHERE g."id" = ?`, id
  );

  return NextResponse.json({ group: normalizeGroup(group) }, { status: 201 });
}

function normalizeGroup(g: any) {
  return { ...g, isPublic: g.isPublic === 1 || g.isPublic === true, memberCount: Number(g.memberCount ?? 0), tags: g.tags ? tryParse(g.tags) : [] };
}
function tryParse(s: string) { try { return JSON.parse(s); } catch { return []; } }
