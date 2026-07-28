import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { hidden } = await req.json().catch(() => ({}));
  try {
    await prisma.post.update({ where: { id: params.id }, data: { hidden: !!hidden } });
    await prisma.adminLog.create({ data: { actorId: user.id, action: hidden ? "POST_HIDE" : "POST_SHOW", target: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    // 존재하지 않는 게시글(P2025) → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
