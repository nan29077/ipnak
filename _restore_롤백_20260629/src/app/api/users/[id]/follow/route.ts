import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  if (user.id === params.id) return NextResponse.json({ error: "자기 자신은 팔로우할 수 없습니다." }, { status: 400 });
  const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: params.id } } });
  if (existing) await prisma.follow.delete({ where: { id: existing.id } });
  else await prisma.follow.create({ data: { followerId: user.id, followingId: params.id } });
  return NextResponse.json({ following: !existing });
}
