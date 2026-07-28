import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const { channel } = await req.json().catch(() => ({}));
  await prisma.shareEvent.create({ data: { postId: params.id, userId: user?.id ?? null, channel: channel || "link" } });
  return NextResponse.json({ ok: true });
}
