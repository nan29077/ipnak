import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 내 알림 목록 조회
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [], unread: 0 });
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id, type: n.type, body: n.body, link: (n as any).link ?? null, read: n.read, createdAt: n.createdAt.toISOString(),
    })),
    unread,
  });
}

// 알림 읽음 처리 ({ id } 없으면 전체 읽음)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.id) {
    await prisma.notification.updateMany({ where: { id: b.id, userId: user.id }, data: { read: true } });
  } else {
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
