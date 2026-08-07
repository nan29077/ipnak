export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isImageDataUri, saveDataUriAvatar } from "@/lib/avatarStorage";

/** PATCH /api/me — 프로필 업데이트 (닉네임, 이름, 전화번호, 소개, 지역, 프로필사진) */
export async function PATCH(req: Request) {
  let user;
  try { user = await requireUser(); } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { nickname, name, phone, bio, region, avatarUrl } = body as Record<string, string | undefined>;

  const data: Record<string, string | null> = {};
  if (typeof nickname === "string" && nickname.trim().length >= 2) {
    data.nickname = nickname.trim().slice(0, 20);
  }
  if (typeof name === "string") data.name = name.trim().slice(0, 30) || null;
  if (typeof phone === "string") data.phone = phone.trim().slice(0, 20) || null;
  if (typeof bio === "string") data.bio = bio.trim().slice(0, 200) || null;
  if (typeof region === "string") data.region = region.trim().slice(0, 30) || null;
  if (typeof avatarUrl === "string") {
    if (isImageDataUri(avatarUrl)) {
      // base64 data URI 는 DB 에 그대로 저장하지 않고 파일로 저장한 뒤 URL 만 기록한다
      try {
        const savedUrl = await saveDataUriAvatar(avatarUrl);
        if (!savedUrl) {
          return NextResponse.json({ error: "프로필 사진 형식이 올바르지 않습니다." }, { status: 400 });
        }
        data.avatarUrl = savedUrl;
      } catch (e) {
        console.error("Avatar save error:", e);
        return NextResponse.json({ error: "프로필 사진 저장에 실패했습니다." }, { status: 500 });
      }
    } else {
      data.avatarUrl = avatarUrl || null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, nickname: true, name: true, phone: true, bio: true, region: true, avatarUrl: true },
  });

  return NextResponse.json({ user: updated });
}
