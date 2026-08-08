export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { isSmsReady, issueResetCode, purgeExpiredResetCodes, CODE_TTL_MS } from "@/lib/passwordReset";

/**
 * POST /api/auth/forgot-password  { email }
 *
 * 응답은 이메일 가입 여부와 무관하게 항상 동일하다.
 * (가입 여부가 드러나면 계정 존재 여부를 확인하는 데 악용될 수 있다)
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`forgot:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({}));
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json({ error: "올바른 이메일을 입력하세요." }, { status: 400 });
  }

  purgeExpiredResetCodes();

  // SMS 미연동이면 인증번호를 만들지 않고 안내만 돌려준다.
  if (!(await isSmsReady())) {
    return NextResponse.json({
      smsReady: false,
      message: "현재 SMS 서비스가 연결되지 않았습니다. 관리자에게 문의해 주세요.",
    });
  }

  // 존재하지 않는 이메일이어도 동일하게 진행한다(발송만 건너뜀).
  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }).catch(() => null);
  await issueResetCode(normalized, user?.id ?? null);

  return NextResponse.json({
    smsReady: true,
    expiresInSec: Math.floor(CODE_TTL_MS / 1000),
    message: "가입 시 등록된 휴대폰으로 인증번호를 보냈습니다. 5분 안에 입력해 주세요.",
  });
}
