import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  if (!phone || !code) {
    return NextResponse.json({ error: "전화번호와 인증번호를 입력하세요." }, { status: 400 });
  }

  const cleaned = phone.replace(/-/g, "").trim();

  // 브루트포스 방어: 전화번호당 5분 10회, IP당 5분 20회
  const ip = getClientIp(req);
  if (!rateLimit(`otp-verify:${cleaned}`, 10, 300_000)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }
  if (!rateLimit(`otp-verify-ip:${ip}`, 20, 300_000)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  const record = await prisma.phoneVerification.findFirst({
    where: {
      phone: cleaned,
      code: String(code).trim(),
      verified: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json({ error: "인증번호가 올바르지 않거나 만료되었습니다." }, { status: 400 });
  }

  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { verified: true },
  });

  return NextResponse.json({ ok: true, message: "인증이 완료되었습니다." });
}
