/**
 * 입낚키링 연동 API
 * - GET    /api/keyrings : 현재 사용자의 연동된 키링 목록
 * - POST   /api/keyrings : 키링 ID를 현재 계정에 등록 { keyringId: string }
 * - DELETE /api/keyrings : 키링 연동 해제 { id: string }
 *   (NFC 자동 읽기 또는 수동 입력 모두 동일 엔드포인트 사용)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureKeyringTables();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const keyrings = await prisma.$queryRawUnsafe<
      { id: string; keyringId: string; linkedAt: string }[]
    >(
      `SELECT id, keyringId, linkedAt FROM LinkedKeyring WHERE userId = ? ORDER BY linkedAt DESC`,
      user.id
    );
    return NextResponse.json({ keyrings });
  } catch {
    return NextResponse.json({ error: "키링 목록을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureKeyringTables();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    // IP당 분당 10회 제한
    const ip = getClientIp(req);
    if (!rateLimit(`keyring-register:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const keyringId = typeof body?.keyringId === "string" ? body.keyringId.trim().toUpperCase() : "";
    if (!keyringId) return NextResponse.json({ error: "keyringId가 필요합니다." }, { status: 400 });

    // 화이트리스트 검증
    const registryRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakKeyringRegistry WHERE keyringId = ? AND isActive = 1`,
      keyringId
    );
    if (Number(registryRows[0]?.cnt ?? 0) === 0) {
      return NextResponse.json(
        { error: "유효하지 않은 키링 ID입니다. 관리자에게 문의해 주세요." },
        { status: 400 }
      );
    }

    // 글로벌 유니크: 다른 계정에 이미 연동 중이면 거부
    const takenRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM LinkedKeyring WHERE keyringId = ? AND userId != ?`,
      keyringId, user.id
    );
    if (Number(takenRows[0]?.cnt ?? 0) > 0) {
      return NextResponse.json(
        { error: "이 키링 ID는 다른 계정에 이미 연동되어 있어요. 기존 계정에서 연동 해제 후 다시 시도해 주세요." },
        { status: 409 }
      );
    }

    // 이미 내 계정에 등록된 키링이면 그대로 반환
    const existingRows = await prisma.$queryRawUnsafe<{ id: string; keyringId: string; linkedAt: string }[]>(
      `SELECT id, keyringId, linkedAt FROM LinkedKeyring WHERE userId = ? AND keyringId = ?`,
      user.id, keyringId
    );
    if (existingRows.length > 0) {
      return NextResponse.json({ keyring: existingRows[0], alreadyLinked: true });
    }

    const { randomBytes } = await import("crypto");
    const id = "lkr_" + randomBytes(12).toString("base64url");
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await prisma.$executeRawUnsafe(
      `INSERT INTO LinkedKeyring (id, userId, keyringId, linkedAt) VALUES (?, ?, ?, ?)`,
      id, user.id, keyringId, now
    );
    return NextResponse.json({ keyring: { id, keyringId, linkedAt: now }, alreadyLinked: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "키링 등록에 실패했어요." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureKeyringTables();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM LinkedKeyring WHERE id = ? AND userId = ?`,
      id, user.id
    );
    if (result === 0) return NextResponse.json({ error: "키링을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "연동 해제에 실패했어요." }, { status: 500 });
  }
}
