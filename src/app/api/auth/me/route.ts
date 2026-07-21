export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/auth/me — 현재 로그인된 사용자 정보 반환 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      bio: user.bio,
      region: user.region,
      avatarUrl: user.avatarUrl,
      email: user.email,
    },
  });
}
