import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { aiSettingKey, protectAiCredential, getAiConnectionStatus, type AiCredentialName } from "@/lib/aiCredentials";

export const dynamic = "force-dynamic";

/**
 * 해양·기상 공공 API 키 관리 (관리자 전용).
 *  - TIDE_API_KEY    : 국립해양조사원(KHOA) 오픈API 인증키 — 물때/조석, 수온, 기압, 해상 풍향
 *  - WEATHER_API_KEY : 기상청 단기예보 조회서비스(공공데이터포털) 인증키 — 기온/풍향/풍속/습도
 *
 * 저장 방식은 기존 AI 연동 키와 동일하다 (Setting 테이블 + AES-256-GCM 암호화).
 * 값을 확인할 수는 없고 등록 여부만 노출한다.
 */

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json({ error: "권한이 없습니다." }, { status: forbidden ? 403 : 401 });
  }
  const status = await getAiConnectionStatus();
  return NextResponse.json({
    tideConfigured: status.tideConfigured,
    weatherConfigured: status.weatherConfigured,
  });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json({ error: "권한이 없습니다." }, { status: forbidden ? 403 : 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const entries: [AiCredentialName, unknown][] = [
    ["tideApiKey", body.tideApiKey],
    ["weatherApiKey", body.weatherApiKey],
  ];

  for (const [, value] of entries) {
    if (value != null && (typeof value !== "string" || value.length > 512)) {
      return NextResponse.json({ error: "API 키 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }

  // 빈 값은 "변경 안 함"으로 취급한다 — 기존 키를 실수로 지우지 않게 한다.
  const toSave = entries.filter(([, v]) => typeof v === "string" && v.trim()) as [AiCredentialName, string][];
  if (toSave.length === 0) {
    return NextResponse.json({ error: "저장할 API 키를 입력해 주세요." }, { status: 400 });
  }

  await Promise.all(
    toSave.map(([name, value]) => {
      const encrypted = protectAiCredential(value);
      return prisma.setting.upsert({
        where: { key: aiSettingKey(name) },
        update: { value: encrypted },
        create: { key: aiSettingKey(name), value: encrypted },
      });
    }),
  );

  await prisma.adminLog.create({
    data: {
      actorId: user.id,
      action: "MARINE_API_SAVE",
      target: "MARINE_API",
      detail: toSave.map(([name]) => name).join(", "),
    },
  });

  const status = await getAiConnectionStatus();
  return NextResponse.json({
    ok: true,
    tideConfigured: status.tideConfigured,
    weatherConfigured: status.weatherConfigured,
  });
}
