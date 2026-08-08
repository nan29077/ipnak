import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function authorizedChat(chatId: string, userId: string) {
  const chat = await prisma.marketChat.findUnique({
    where: { id: chatId },
    include: {
      listing: { select: { sellerId: true, title: true } },
      buyer: { select: { id: true, nickname: true } },
    },
  });
  if (!chat) return null;
  if (chat.buyerId !== userId && chat.listing.sellerId !== userId) return null;
  return chat;
}

// 메시지 목록 — 조회 시 상대방이 보낸 미읽음 메시지를 읽음 처리
export async function GET(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const chat = await authorizedChat(params.id, user.id);
  if (!chat) return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });

  // 상대방이 보낸 미읽음 메시지 일괄 읽음 처리
  await (prisma as any).marketMessage.updateMany({
    where: {
      chatId: params.id,
      senderId: { not: user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  }).catch(() => { /* readAt 컬럼 없는 구버전 DB 대응 */ });

  const messages = await prisma.marketMessage.findMany({
    where: { chatId: params.id }, orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages, me: user.id });
}

// 서버가 인정하는 시스템 메시지 원문 (판매 상태 변경 시 판매자 클라이언트가 전송).
// 이 목록에 없는 "[시스템]" 메시지는 위조로 간주해 prefix 를 제거한다.
const SYSTEM_MESSAGES = new Set([
  "[시스템] 판매자가 이 상품을 예약중으로 변경했습니다.",
  "[시스템] 판매자가 예약을 취소하고 판매중으로 변경했습니다.",
  "[시스템] 거래가 완료됐습니다. 감사합니다! 🎉",
]);

// 메시지 전송 — 전송 후 상대방에게 앱 알림 생성
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const chat = await authorizedChat(params.id, user.id);
  if (!chat) return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  let body = (b.body || "").trim();
  if (!body) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });

  // ── 시스템 메시지 위조 차단 ──
  // "[시스템]" prefix 는 판매자가 보내는 화이트리스트 원문일 때만 허용한다.
  // (일반 사용자가 가짜 시스템 안내로 사기를 유도하는 것을 방지)
  if (body.startsWith("[시스템]")) {
    const isSeller = user.id === chat.listing.sellerId;
    if (!isSeller || !SYSTEM_MESSAGES.has(body)) {
      body = body.replace(/^(\[시스템\]\s*)+/, "").trim();
      if (!body) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    }
  }

  const message = await prisma.marketMessage.create({
    data: { chatId: params.id, senderId: user.id, body },
    include: { sender: { select: { nickname: true } } },
  });
  await prisma.marketChat.update({ where: { id: params.id }, data: { updatedAt: new Date() } });

  // 상대방 알림 생성 (시스템 메시지는 알림 생략)
  if (!body.startsWith("[시스템]")) {
    const recipientId = user.id === chat.listing.sellerId ? chat.buyerId : chat.listing.sellerId;
    const senderNick = message.sender.nickname;
    const listingTitle = chat.listing.title.length > 20
      ? chat.listing.title.slice(0, 20) + "…"
      : chat.listing.title;
    const preview = body.length > 30 ? body.slice(0, 30) + "…" : body;

    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: "MARKET_CHAT",
        body: `${senderNick}: ${preview} — ${listingTitle}`,
        link: `/market/chats/${params.id}`,
        actorId: user.id,
      },
    }).catch(() => { /* 알림 생성 실패는 메시지 전송 성공에 영향 없음 */ });
  }

  return NextResponse.json({ ok: true, message });
}
