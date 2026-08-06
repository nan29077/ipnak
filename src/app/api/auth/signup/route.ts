import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";

const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

// 필드 자체가 빠진 경우 zod 기본 메시지("Required")가 그대로 노출되므로 한국어로 지정한다
const schema = z.object({
  email: z.string({ required_error: "이메일을 입력하세요." }).email("올바른 이메일을 입력하세요."),
  password: z
    .string({ required_error: "비밀번호를 입력하세요." })
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(PW_REGEX, "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."),
  nickname: z.string().min(2, "닉네임은 2자 이상이어야 합니다.").optional(),
  name: z.string({ required_error: "이름을 입력하세요." }).min(1, "이름을 입력하세요."),
  phone: z.string({ required_error: "전화번호를 입력하세요." }).min(1, "전화번호를 입력하세요."),
  fishingMethods: z.array(z.string()).optional(),
  fishSpecies: z.array(z.string()).optional(),
  // 구버전 호환 (flat array)
  interests: z.array(z.string()).optional(),
  // 약관 동의 여부 (위치정보법 준수)
  termsConsent: z.boolean().optional(),
  privacyConsent: z.boolean().optional(),
  locationConsent: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, password, nickname, name, phone, fishingMethods, fishSpecies, interests, termsConsent, privacyConsent, locationConsent } = parsed.data;
  // 닉네임 미입력 시 이메일 앞자리 + 4자리 랜덤 숫자로 자동 생성
  const finalNickname = nickname || (email.split("@")[0] + Math.floor(1000 + Math.random() * 9000));

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

  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        nickname: finalNickname,
        name,
        phone,
        role: "ANGLER",
        avatarUrl: null,
        interests: interestsPayload,
        termsConsent: termsConsent ?? false,
        privacyConsent: privacyConsent ?? false,
        locationConsent: locationConsent ?? false,
      },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // findUnique 확인과 create 사이 경쟁 조건으로 인한 중복(P2002) → 409로 정돈
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
