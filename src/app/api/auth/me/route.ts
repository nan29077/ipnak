export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/auth/me — 현재 로그인된 사용자 정보 반환 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  // getCurrentUser는 passwordHash를 제외해 반환하므로 존재 여부만 따로 확인한다.
  // (소셜 전용 계정은 비밀번호 변경 대신 안내 문구를 보여주기 위함)
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      bio: user.bio,
      region: user.region,
      avatarUrl: user.avatarUrl,
      email: user.email,
      hasPassword: Boolean(row?.passwordHash),
    },
  });
}
