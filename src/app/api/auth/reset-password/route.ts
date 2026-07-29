export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { consumeResetToken } from "@/lib/passwordReset";

// 회원가입·비밀번호 변경과 동일한 강도 기준
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

/**
 * PATCH /api/auth/reset-password  { email, resetToken, newPassword }
 * 인증번호 검증을 통과해 받은 1회용 토큰으로만 비밀번호를 바꿀 수 있다.
 */
export async function PATCH(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`resetpw:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { email, resetToken, newPassword } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof resetToken !== "string" || typeof newPassword !== "string" || !email.trim() || !resetToken || !newPassword) {
    return NextResponse.json({ error: "요청 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (!PW_REGEX.test(newPassword)) {
    return NextResponse.json({ error: "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다." }, { status: 400 });
  }

  const userId = await consumeResetToken(email.trim().toLowerCase(), resetToken);
  if (!userId) {
    return NextResponse.json({ error: "인증이 만료되었습니다. 처음부터 다시 시도해 주세요." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // 비밀번호를 되찾은 상황이므로 기존 로그인 세션은 모두 끊는다.
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
