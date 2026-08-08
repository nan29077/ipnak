/**
 * 입낚키링 ID 레지스트리 관리 API (관리자 전용)
 * GET    /api/admin/ipnak-keyring/registry  — 전체 목록 (검색/페이지네이션)
 * POST   /api/admin/ipnak-keyring/registry  — 새 키링 ID 등록
 * PATCH  /api/admin/ipnak-keyring/registry  — isActive 토글
 * DELETE /api/admin/ipnak-keyring/registry  — 키링 ID 삭제 (연동 회원 cascade)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from "crypto";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

function makeId(): string {
  return "kreg_" + randomBytes(12).toString("base64url");
}

// ──────────────── GET ────────────────
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await ensureKeyringTables();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;

  try {
    type RowType = {
      id: string;
      keyringId: string;
      memo: string | null;
      isActive: number | boolean;
      createdAt: string;
      linkedUserId: string | null;
      linkedUserNickname: string | null;
      linkedUserPhone: string | null;
    };

    const where = q ? `WHERE r.keyringId LIKE ? OR r.memo LIKE ?` : ``;
    const whereCount = q ? `WHERE keyringId LIKE ? OR memo LIKE ?` : ``;
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<RowType[]>(
        `SELECT r.id, r.keyringId, r.memo, r.isActive, r.createdAt,
                lk.userId as linkedUserId,
                u.nickname as linkedUserNickname,
                u.phone as linkedUserPhone
         FROM IpnakKeyringRegistry r
         LEFT JOIN LinkedKeyring lk ON lk.keyringId = r.keyringId
         LEFT JOIN User u ON u.id = lk.userId
         ${where}
         ORDER BY r.createdAt DESC LIMIT ? OFFSET ?`,
        ...params, take, skip
      ),
      prisma.$queryRawUnsafe<[{ cnt: number }]>(
        `SELECT COUNT(*) as cnt FROM IpnakKeyringRegistry ${whereCount}`,
        ...params
      ),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);
    const items = rows.map(r => ({ ...r, isActive: Boolean(r.isActive) }));
    return NextResponse.json({ items, total, page, take });
  } catch (e) {
    console.error("[keyring registry GET]", e);
    return NextResponse.json({ error: "목록 조회 실패" }, { status: 500 });
  }
}

// ──────────────── POST ────────────────
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await ensureKeyringTables();

  const body = await req.json().catch(() => null);
  const keyringId = typeof body?.keyringId === "string" ? body.keyringId.trim().toUpperCase() : "";
  const memo = typeof body?.memo === "string" ? body.memo.trim() : null;
  if (!keyringId) return NextResponse.json({ error: "키링 ID가 필요합니다." }, { status: 400 });

  try {
    const exists = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakKeyringRegistry WHERE keyringId = ?`, keyringId
    );
    if (Number(exists[0]?.cnt) > 0) {
      return NextResponse.json({ error: "이미 등록된 키링 ID입니다." }, { status: 409 });
    }

    const id = makeId();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await prisma.$executeRawUnsafe(
      `INSERT INTO IpnakKeyringRegistry (id, keyringId, memo, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, ?)`,
      id, keyringId, memo, now, now
    );
    return NextResponse.json({ id, keyringId, memo, isActive: true, createdAt: now }, { status: 201 });
  } catch (e) {
    console.error("[keyring registry POST]", e);
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}

// ──────────────── PATCH ────────────────
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await ensureKeyringTables();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : undefined;
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    if (isActive !== null) {
      await prisma.$executeRawUnsafe(
        `UPDATE IpnakKeyringRegistry SET isActive = ?, updatedAt = ? WHERE id = ?`,
        isActive ? 1 : 0, now, id
      );
    }
    if (memo !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE IpnakKeyringRegistry SET memo = ?, updatedAt = ? WHERE id = ?`,
        memo || null, now, id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[keyring registry PATCH]", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// ──────────────── DELETE ────────────────
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await ensureKeyringTables();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    const rows = await prisma.$queryRawUnsafe<[{ keyringId: string }]>(
      `SELECT keyringId FROM IpnakKeyringRegistry WHERE id = ?`, id
    );
    const keyringId = rows[0]?.keyringId;

    // LinkedKeyring 먼저 cascade 삭제
    if (keyringId) {
      await prisma.$executeRawUnsafe(`DELETE FROM LinkedKeyring WHERE keyringId = ?`, keyringId);
    }
    await prisma.$executeRawUnsafe(`DELETE FROM IpnakKeyringRegistry WHERE id = ?`, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[keyring registry DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
