import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS, sendAlimtalk } from "@/lib/aligo";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    type,           // "sms" | "alimtalk"
    target,         // "all" | "specific"
    phones,         // string[] — target === "specific" 일 때
    message,        // 발송 메시지
    templateCode,   // 알림톡 템플릿 코드 (type === "alimtalk" 일 때 필수)
  } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "메시지를 입력하세요." }, { status: 400 });
  }
  if (!["sms", "alimtalk"].includes(type)) {
    return NextResponse.json({ error: "발송 유형을 선택하세요." }, { status: 400 });
  }

  let targetPhones: string[] = [];

  if (target === "all") {
    const users = await prisma.user.findMany({
      where: { phone: { not: null } },
      select: { phone: true },
    });
    targetPhones = users.map((u) => u.phone!).filter(Boolean);
  } else if (target === "specific" && Array.isArray(phones)) {
    targetPhones = phones.filter((p) => typeof p === "string" && p.trim());
  }

  if (targetPhones.length === 0) {
    return NextResponse.json({ error: "발송 대상이 없습니다." }, { status: 400 });
  }

  if (type === "sms") {
    // SMS는 건건이 발송 (대량 발송 시 속도 주의)
    let successCount = 0;
    let failCount = 0;
    for (const phone of targetPhones) {
      const result = await sendSMS(phone, message);
      if (result.success) successCount++;
      else failCount++;
    }
    return NextResponse.json({ ok: true, successCount, failCount, total: targetPhones.length });
  }

  if (type === "alimtalk") {
    if (!templateCode?.trim()) {
      return NextResponse.json({ error: "알림톡 템플릿 코드를 입력하세요." }, { status: 400 });
    }
    const targets = targetPhones.map((phone) => ({ phone }));
    const result = await sendAlimtalk(targets, templateCode, message);
    return NextResponse.json({ ok: result.success, message: result.message, total: targetPhones.length });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
