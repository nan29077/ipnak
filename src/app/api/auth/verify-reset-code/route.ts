export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { verifyResetCode, MAX_ATTEMPTS } from "@/lib/passwordReset";

/**
 * POST /api/auth/verify-reset-code  { email, code }
 * 성공 시 새 비밀번호 설정에 쓸 1회용 토큰을 발급한다.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`verifycode:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { email, code } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string" || !email.trim() || !/^\d{6}$/.test(code.trim())) {
    return NextResponse.json({ error: "6자리 인증번호를 입력해 주세요." }, { status: 400 });
  }

  const result = await verifyResetCode(email.trim().toLowerCase(), code.trim());
  if (result.ok) {
    return NextResponse.json({ ok: true, resetToken: result.token });
  }

  // 이메일 가입 여부가 드러나지 않도록 사유별 문구만 다르게 하고 계정 정보는 담지 않는다.
  const message =
    result.reason === "expired" ? "인증번호가 만료되었습니다. 처음부터 다시 시도해 주세요."
    : result.reason === "locked" ? `인증 ${MAX_ATTEMPTS}회 실패로 인증번호가 무효화되었습니다. 처음부터 다시 시도해 주세요.`
    : "인증번호가 올바르지 않습니다.";
  return NextResponse.json({ error: message }, { status: 400 });
}
