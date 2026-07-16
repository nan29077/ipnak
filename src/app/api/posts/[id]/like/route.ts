import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const existing = await prisma.like.findUnique({ where: { postId_userId: { postId: params.id, userId: user.id } } });
  if (existing) await prisma.like.delete({ where: { id: existing.id } });
  else await prisma.like.create({ data: { postId: params.id, userId: user.id } });
  const count = await prisma.like.count({ where: { postId: params.id } });
  return NextResponse.json({ liked: !existing, count });
}
