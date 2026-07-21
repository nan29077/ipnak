import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function authorizedChat(chatId: string, userId: string) {
  const chat = await prisma.marketChat.findUnique({
    where: { id: chatId },
    include: { listing: { select: { sellerId: true } } },
  });
  if (!chat) return null;
  if (chat.buyerId !== userId && chat.listing.sellerId !== userId) return null;
  return chat;
}

// 메시지 목록
export async function GET(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const chat = await authorizedChat(params.id, user.id);
  if (!chat) return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  const messages = await prisma.marketMessage.findMany({
    where: { chatId: params.id }, orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages, me: user.id });
}

// 메시지 전송
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const chat = await authorizedChat(params.id, user.id);
  if (!chat) return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const body = (b.body || "").trim();
  if (!body) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  const message = await prisma.marketMessage.create({
    data: { chatId: params.id, senderId: user.id, body },
  });
  await prisma.marketChat.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true, message });
}
