/**
 * 푸시 토큰 등록/해제 API
 * - POST   /api/notifications/register-token  { token, platform, appVersion? }
 * - DELETE /api/notifications/register-token  { token }
 *
 * 토큰은 Prisma 마이그레이션 없이 파일 저장소(src/lib/pushTokenStore.ts)에 보관한다.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { savePushToken, deletePushToken, type PushPlatform } from "@/lib/pushTokenStore";

export const dynamic = "force-dynamic";

const PLATFORMS: PushPlatform[] = ["android", "ios", "web"];

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 앱 실행마다 1회 호출되는 엔드포인트 — IP당 분당 20회로 제한
    const ip = getClientIp(req);
    if (!rateLimit(`push-token:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 512) {
      return NextResponse.json({ error: "token 이 필요합니다." }, { status: 400 });
    }

    const rawPlatform = typeof body?.platform === "string" ? body.platform : "web";
    const platform: PushPlatform = PLATFORMS.includes(rawPlatform as PushPlatform)
      ? (rawPlatform as PushPlatform)
      : "web";

    const appVersion =
      typeof body?.appVersion === "string" ? body.appVersion.slice(0, 32) : null;

    await savePushToken({ userId: user.id, token, platform, appVersion });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "토큰 저장에 실패했어요." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "token 이 필요합니다." }, { status: 400 });
    }
    const removed = await deletePushToken(token);
    return NextResponse.json({ ok: true, removed });
  } catch {
    return NextResponse.json({ error: "토큰 삭제에 실패했어요." }, { status: 500 });
  }
}
