import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { hidden } = await req.json().catch(() => ({}));
  await prisma.post.update({ where: { id: params.id }, data: { hidden: !!hidden } });
  await prisma.adminLog.create({ data: { actorId: user.id, action: hidden ? "POST_HIDE" : "POST_SHOW", target: params.id } });
  return NextResponse.json({ ok: true });
}
