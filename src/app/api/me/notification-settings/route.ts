export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NotifRow = {
  pushEnabled: number | boolean;
  newComment: number | boolean;
  newLike: number | boolean;
  groupActivity: number | boolean;
  announcement: number | boolean;
  ballRelated: number | boolean;
};

function toResponse(row: NotifRow) {
  return {
    pushEnabled: Boolean(row.pushEnabled),
    newComment: Boolean(row.newComment),
    newLike: Boolean(row.newLike),
    groupActivity: Boolean(row.groupActivity),
    announcement: Boolean(row.announcement),
    ballRelated: Boolean(row.ballRelated),
  };
}

const DEFAULTS = {
  pushEnabled: false,
  newComment: true,
  newLike: true,
  groupActivity: true,
  announcement: true,
  ballRelated: true,
};

/** GET /api/me/notification-settings — 알림 설정 조회 */
export async function GET() {
  let user;
  try { user = await requireUser(); } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rows = await prisma.$queryRawUnsafe<NotifRow[]>(
    `SELECT pushEnabled, newComment, newLike, groupActivity, announcement, ballRelated
     FROM \`NotificationSettings\` WHERE \`userId\` = ? LIMIT 1`,
    user.id
  );

  if (!rows.length) return NextResponse.json(DEFAULTS);
  return NextResponse.json(toResponse(rows[0]));
}

/** PUT /api/me/notification-settings — 알림 설정 저장 */
export async function PUT(req: Request) {
  let user;
  try { user = await requireUser(); } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Partial<Record<keyof typeof DEFAULTS, boolean>>;

  const allowed = ["pushEnabled", "newComment", "newLike", "groupActivity", "announcement", "ballRelated"] as const;
  const updates: Partial<typeof DEFAULTS> = {};
  for (const key of allowed) {
    if (typeof body[key] === "boolean") updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
  }

  // 기존 행 확인
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM \`NotificationSettings\` WHERE \`userId\` = ? LIMIT 1`,
    user.id
  );

  if (existing.length === 0) {
    // INSERT
    const merged = { ...DEFAULTS, ...updates };
    const id = crypto.randomUUID();
    await prisma.$queryRawUnsafe(
      `INSERT INTO \`NotificationSettings\` (\`id\`, \`userId\`, \`pushEnabled\`, \`newComment\`, \`newLike\`, \`groupActivity\`, \`announcement\`, \`ballRelated\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      id, user.id,
      merged.pushEnabled ? 1 : 0,
      merged.newComment ? 1 : 0,
      merged.newLike ? 1 : 0,
      merged.groupActivity ? 1 : 0,
      merged.announcement ? 1 : 0,
      merged.ballRelated ? 1 : 0
    );
  } else {
    // UPDATE — 변경된 필드만
    const setClauses = allowed
      .filter((k) => k in updates)
      .map((k) => `\`${k}\` = ?`)
      .join(", ");
    const values = allowed
      .filter((k) => k in updates)
      .map((k) => (updates[k] ? 1 : 0));
    await prisma.$queryRawUnsafe(
      `UPDATE \`NotificationSettings\` SET ${setClauses}, updatedAt = NOW() WHERE \`userId\` = ?`,
      ...values, user.id
    );
  }

  // 최신값 반환
  const rows = await prisma.$queryRawUnsafe<NotifRow[]>(
    `SELECT pushEnabled, newComment, newLike, groupActivity, announcement, ballRelated
     FROM \`NotificationSettings\` WHERE \`userId\` = ? LIMIT 1`,
    user.id
  );
  return NextResponse.json(rows.length ? toResponse(rows[0]) : { ...DEFAULTS, ...updates });
}
