import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SETTING_KEYS = ["aligo_api_key", "aligo_user_id", "aligo_sender", "aligo_sender_key"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const settings = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    apiKey: map["aligo_api_key"] || "",
    userId: map["aligo_user_id"] || "",
    sender: map["aligo_sender"] || "",
    senderKey: map["aligo_sender_key"] || "",
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { apiKey, userId, sender, senderKey } = body;

  const upserts = [
    { key: "aligo_api_key", value: String(apiKey || "") },
    { key: "aligo_user_id", value: String(userId || "") },
    { key: "aligo_sender", value: String(sender || "") },
    { key: "aligo_sender_key", value: String(senderKey || "") },
  ];

  await Promise.all(
    upserts.map((u) =>
      prisma.setting.upsert({
        where: { key: u.key },
        create: u,
        update: { value: u.value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
