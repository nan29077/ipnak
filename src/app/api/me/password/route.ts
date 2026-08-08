export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 회원가입(/api/auth/signup)과 동일한 비밀번호 강도 기준을 사용한다.
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

/** PATCH /api/me/password — 비밀번호 변경 (현재 비밀번호 확인 필요) */
export async function PATCH(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호를 입력하세요." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (!PW_REGEX.test(newPassword)) {
    return NextResponse.json({ error: "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다." }, { status: 400 });
  }

  // getCurrentUser는 passwordHash를 제외하고 반환하므로 여기서 다시 조회한다.
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row) return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });

  // 소셜 로그인 전용 계정 등 비밀번호가 없는 경우
  if (!row.passwordHash) {
    return NextResponse.json({ error: "비밀번호가 설정되지 않은 계정입니다." }, { status: 409 });
  }
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (await verifyPassword(newPassword, row.passwordHash)) {
    return NextResponse.json({ error: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
