/**
 * 입낚볼 레지스트리 — 회원 연동만 해제 (관리자 전용)
 * DELETE /api/admin/ipnak-ball/registry/[id]/unlink
 *   - IpnakBallRegistry 의 id 로 볼을 찾아 해당 볼의 LinkedBall 레코드만 삭제한다.
 *   - 레지스트리 자체(IpnakBallRegistry)는 그대로 두므로, 같은 볼을 다른 회원이 다시 연동할 수 있다.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 관리자 권한 확인 헬퍼 (registry route.ts 와 동일 기준)
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    const rows = await prisma.$queryRawUnsafe<{ ballId: string }[]>(
      `SELECT ballId FROM IpnakBallRegistry WHERE id = ?`, id
    );
    const ballId = rows[0]?.ballId;
    if (!ballId) {
      return NextResponse.json({ error: "등록되지 않은 볼 ID입니다." }, { status: 404 });
    }

    // 연동 레코드만 삭제 — 삭제된 행이 없으면 애초에 연동되어 있지 않았던 것
    const removed = await prisma.$executeRawUnsafe(
      `DELETE FROM LinkedBall WHERE ballId = ?`, ballId
    );
    if (!removed) {
      return NextResponse.json({ error: "연동된 회원이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ballId });
  } catch (e) {
    console.error("[registry unlink DELETE]", e);
    return NextResponse.json({ error: "연동 해제 실패" }, { status: 500 });
  }
}
