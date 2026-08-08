/**
 * 사용자 낚시 관심사 API
 * - GET  /api/user/interests : 현재 사용자의 관심사 조회
 * - POST /api/user/interests : 관심사 저장 { methods: string[], species: string[] }
 *   (소셜 로그인 후 팝업에서 관심사를 설정할 때 사용)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseInterests } from "@/lib/interestsUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { interests: true, nickname: true },
  });

  const interests = parseInterests(dbUser?.interests ?? null);
  return NextResponse.json({ interests, nickname: dbUser?.nickname });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const methods = Array.isArray(body.methods) ? body.methods.map(String) : [];
  const species = Array.isArray(body.species) ? body.species.map(String) : [];

  await prisma.user.update({
    where: { id: user.id },
    data: { interests: JSON.stringify({ methods, species }) },
  });

  return NextResponse.json({ ok: true });
}
