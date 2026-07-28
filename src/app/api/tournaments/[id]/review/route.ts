import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { entryId, status } = await req.json().catch(() => ({}));
  if (!["APPROVED", "REJECTED", "REVIEW"].includes(status)) return NextResponse.json({ error: "잘못된 상태" }, { status: 400 });
  await prisma.tournamentEntry.update({ where: { id: entryId }, data: { status } });
  await prisma.adminLog.create({ data: { actorId: user.id, action: `ENTRY_${status}`, target: entryId } });
  return NextResponse.json({ ok: true });
}
