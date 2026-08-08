import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/aligo";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/** 인증번호 유효 시간: 5분 */
const OTP_TTL_MS = 5 * 60 * 1000;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "전화번호를 입력하세요." }, { status: 400 });
  }

  const cleaned = phone.replace(/-/g, "").trim();
  if (!/^01[0-9]{8,9}$/.test(cleaned)) {
    return NextResponse.json({ error: "올바른 휴대폰 번호를 입력하세요." }, { status: 400 });
  }

  // SMS 발송 비용 공격 방어: IP당 10분에 5회 제한
  const ip = getClientIp(req);
  if (!rateLimit(`send-otp-ip:${ip}`, 5, 600_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
  }

  // 최근 1분 내 발송 제한 (중복 발송 방지)
  const recent = await prisma.phoneVerification.findFirst({
    where: {
      phone: cleaned,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return NextResponse.json({ error: "1분 후 다시 시도하세요." }, { status: 429 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.phoneVerification.create({
    data: { phone: cleaned, code, expiresAt },
  });

  const result = await sendSMS(cleaned, `[입낚] 인증번호: ${code} (5분간 유효)`);

  if (!result.success) {
    // SMS 발송 실패 시 DB 레코드 삭제
    await prisma.phoneVerification.deleteMany({ where: { phone: cleaned, code } });
    return NextResponse.json(
      { error: result.message || "SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "인증번호가 발송되었습니다." });
}
