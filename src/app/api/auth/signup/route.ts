import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
  nickname: z.string().min(2, "닉네임은 2자 이상이어야 합니다."),
  interests: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, password, nickname, interests } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      nickname,
      role: "ANGLER",
      avatarUrl: null, // getAvatarUrl()이 userId 기반 캐릭터 이미지로 처리
      interests: JSON.stringify(interests ?? []),
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
