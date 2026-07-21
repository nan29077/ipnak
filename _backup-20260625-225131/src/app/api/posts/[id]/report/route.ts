import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const { reason } = await req.json().catch(() => ({}));
  await prisma.report.create({ data: { reporterId: user.id, postId: params.id, targetType: "POST", reason: reason || "신고" } });
  return NextResponse.json({ ok: true });
}
