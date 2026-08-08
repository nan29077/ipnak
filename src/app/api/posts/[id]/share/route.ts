import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const { channel } = await req.json().catch(() => ({}));
  try {
    await prisma.shareEvent.create({ data: { postId: params.id, userId: user?.id ?? null, channel: channel || "link" } });
    return NextResponse.json({ ok: true });
  } catch {
    // 삭제된 게시글 등 FK 제약 위반 → 원시 500 대신 정돈된 에러 응답
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
}
