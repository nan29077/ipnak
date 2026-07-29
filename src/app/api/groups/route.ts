import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pointsEnabled, groupPointsRequired, getBalance, chargeGroupCreate, refundGroupCreate, POINT_RULES } from "@/lib/points";

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

  // 포인트 제도 OFF 이면 유료 개설 설정과 무관하게 포인트를 사용하지 않는다.
  // (개설 기능 자체는 그대로 이용 가능 — 차감 로직만 건너뛴다)
  // 최고관리자는 유료 개설이 켜져 있어도 포인트를 차감하지 않는다.
  const [enabled, requirePoints] = await Promise.all([pointsEnabled(), groupPointsRequired()]);
  const paidCreate = enabled && requirePoints && user.role !== "SUPER_ADMIN";

  // 낚시단 유료 개설 ON 이면 10,000P 필요 — 개설 전 잔액 확인
  if (paidCreate) {
    const bal = await getBalance(user.id);
    if (bal < POINT_RULES.GROUP_CREATE_COST)
      return NextResponse.json({ error: `낚시단 개설에는 ${POINT_RULES.GROUP_CREATE_COST.toLocaleString()}P가 필요합니다. (보유 ${bal.toLocaleString()}P)` }, { status: 400 });
  }

  const id = createId();
  const now = new Date().toISOString();

  // 개설 비용 선차감 — 차감에 실패하면 낚시단을 만들지 않는다(무료 개설 방지)
  if (paidCreate) {
    try {
      await chargeGroupCreate(user.id, id);
    } catch {
      return NextResponse.json({ error: "포인트가 부족합니다." }, { status: 400 });
    }
  }

  try {
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
  } catch {
    // 생성에 실패했다면 선차감한 개설 비용을 되돌린다
    if (paidCreate) await refundGroupCreate(user.id, id).catch(() => {});
    // throw 대신 정돈된 500 응답 (raw 500 방지)
    return NextResponse.json({ error: "낚시단 개설 중 오류가 발생했습니다." }, { status: 500 });
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
