import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { sendAlimtalk } from "@/lib/aligo";

const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

/** 인증 완료 레코드 유효 기간 — 이 시간이 지나면 재인증을 요구한다 */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

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

  // 전화번호 인증 우회 방어: 서버에서 verified 상태를 반드시 확인.
  // 인증 레코드는 무기한 유효하면 안 된다 — 한 번 인증한 번호로 몇 달 뒤까지
  // 계정을 계속 찍어낼 수 있기 때문에 24시간 만료 + 가입 시 소모(삭제) 처리한다.
  const cleanPhone = phone.replace(/-/g, "").trim();
  const verified = await prisma.phoneVerification.findFirst({
    where: {
      phone: cleanPhone,
      verified: true,
      createdAt: { gte: new Date(Date.now() - VERIFICATION_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!verified) {
    return NextResponse.json({ ok: false, reason: "phone-not-verified" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  // 한 번호로 계정을 여러 개 만드는 것을 막는다 (User.phone unique 와 짝을 이루는 사전 확인)
  const phoneTaken = await prisma.user.findFirst({ where: { phone: cleanPhone }, select: { id: true } });
  if (phoneTaken) {
    return NextResponse.json({ error: "이미 가입에 사용된 전화번호입니다." }, { status: 409 });
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
        // 하이픈을 제거한 형태로 통일 저장 — 그래야 unique 제약이 실제로 중복을 잡는다
        phone: cleanPhone,
        role: "ANGLER",
        avatarUrl: null,
        interests: interestsPayload,
        termsConsent: termsConsent ?? false,
        privacyConsent: privacyConsent ?? false,
        locationConsent: locationConsent ?? false,
      },
    });
    await createSession(user.id);

    // 인증 레코드 소모 — 같은 인증 1건으로 계정을 여러 개 만들지 못하게 한다.
    // (실패해도 가입 자체는 이미 완료됐으므로 흐름을 막지 않는다)
    prisma.phoneVerification
      .deleteMany({ where: { phone: cleanPhone } })
      .catch((e) => console.error("[signup] 전화번호 인증 레코드 정리 실패:", e));

    // 가입 축하 알림톡 발송 (비동기, 실패해도 가입 흐름에 영향 없음)
    // ALIGO_WELCOME_TPL 환경변수 또는 DB에서 템플릿 코드가 있어야 발송됨
    const tplCode = process.env.ALIGO_WELCOME_TPL;
    if (tplCode && cleanPhone) {
      const welcomeMsg = `${name}님, 입낚 가입을 환영합니다!\n낚시 커뮤니티 입낚에서 즐거운 낚시 생활을 시작해보세요.`;
      sendAlimtalk([{ phone: cleanPhone }], tplCode, welcomeMsg).catch((e) =>
        console.error("[알림톡] 가입 축하 발송 실패:", e)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // 사전 확인과 create 사이 경쟁 조건으로 인한 중복(P2002) → 409로 정돈
    if (e?.code === "P2002") {
      const target = String(e?.meta?.target ?? "");
      if (target.includes("phone")) {
        return NextResponse.json({ error: "이미 가입에 사용된 전화번호입니다." }, { status: 409 });
      }
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
