/**
 * 입낚볼 ID 레지스트리 관리 API (관리자 전용)
 * GET    /api/admin/ipnak-ball/registry        — 전체 목록 (검색/페이지네이션)
 * POST   /api/admin/ipnak-ball/registry        — 새 볼 ID 등록
 * PATCH  /api/admin/ipnak-ball/registry        — isActive 토글
 * DELETE /api/admin/ipnak-ball/registry        — 볼 ID 삭제
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from \`crypto\`;

export const dynamic = "force-dynamic";

// 관리자 권한 확인 헬퍼
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

// cuid 대체용 간단한 ID 생성
function makeId(): string {
  return "reg_" + randomBytes(12).toString("base64url");
}

// ──────────────── GET ────────────────
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;

  try {
    type RowType = {
      id: string;
      ballId: string;
      memo: string | null;
      isActive: number | boolean;
      createdAt: string;
      updatedAt: string;
    };

    const where = q ? `WHERE ballId LIKE ? OR memo LIKE ?` : ``;
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<RowType[]>(
        `SELECT id, ballId, memo, isActive, createdAt, updatedAt
         FROM IpnakBallRegistry ${where}
         ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        ...params, take, skip
      ),
      prisma.$queryRawUnsafe<[{ cnt: number }]>(
        `SELECT COUNT(*) as cnt FROM IpnakBallRegistry ${where}`,
        ...params
      ),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);
    const items = rows.map(r => ({
      ...r,
      isActive: Boolean(r.isActive),
    }));

    return NextResponse.json({ items, total, page, take });
  } catch (e) {
    console.error("[registry GET]", e);
    return NextResponse.json({ error: "목록 조회 실패" }, { status: 500 });
  }
}

// ──────────────── POST ────────────────
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ballId = typeof body?.ballId === "string" ? body.ballId.trim().toUpperCase() : "";
  const memo = typeof body?.memo === "string" ? body.memo.trim() : null;

  if (!ballId) return NextResponse.json({ error: "볼 ID가 필요합니다." }, { status: 400 });

  try {
    // 중복 체크
    const exists = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakBallRegistry WHERE ballId = ?`, ballId
    );
    if (Number(exists[0]?.cnt) > 0) {
      return NextResponse.json({ error: "이미 등록된 볼 ID입니다." }, { status: 409 });
    }

    const id = makeId();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await prisma.$executeRawUnsafe(
      `INSERT INTO IpnakBallRegistry (id, ballId, memo, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, ?)`,
      id, ballId, memo, now, now
    );

    return NextResponse.json({ id, ballId, memo, isActive: true, createdAt: now }, { status: 201 });
  } catch (e) {
    console.error("[registry POST]", e);
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}

// ──────────────── PATCH ────────────────
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : undefined;

  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (isActive !== null) {
      await prisma.$executeRawUnsafe(
        `UPDATE IpnakBallRegistry SET isActive = ?, updatedAt = ? WHERE id = ?`,
        isActive ? 1 : 0, now, id
      );
    }
    if (memo !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE IpnakBallRegistry SET memo = ?, updatedAt = ? WHERE id = ?`,
        memo || null, now, id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[registry PATCH]", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// ──────────────── DELETE ────────────────
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM IpnakBallRegistry WHERE id = ?`, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[registry DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
