import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";

const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(PW_REGEX, "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."),
  nickname: z.string().min(2, "닉네임은 2자 이상이어야 합니다."),
  fishingMethods: z.array(z.string()).optional(),
  fishSpecies: z.array(z.string()).optional(),
  // 구버전 호환 (flat array)
  interests: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, password, nickname, fishingMethods, fishSpecies, interests } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  // interests 포맷: { methods: [...], species: [...] }
  // 구버전(flat array) 요청도 species로 간주해서 호환 처리
  const interestsPayload = JSON.stringify({
    methods: fishingMethods ?? [],
    species: fishSpecies ?? interests ?? [],
  });

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      nickname,
      role: "ANGLER",
      avatarUrl: null,
      interests: interestsPayload,
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
