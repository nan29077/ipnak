import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 소셜 가입 후 약관 동의 처리 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { termsConsent, privacyConsent, locationConsent } = body as {
    termsConsent?: boolean;
    privacyConsent?: boolean;
    locationConsent?: boolean;
  };

  if (!termsConsent || !privacyConsent || !locationConsent) {
    return NextResponse.json({ error: "필수 약관에 모두 동의해야 합니다." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { termsConsent: true, privacyConsent: true, locationConsent: true },
  });

  return NextResponse.json({ ok: true });
}
