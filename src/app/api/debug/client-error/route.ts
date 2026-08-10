/**
 * 클라이언트 에러 수신 — 에러 바운더리(error.tsx / global-error.tsx)에서 전송
 * POST /api/debug/client-error
 *
 * 폰에서만 재현되는 에러(NFC 태그 진입 등)의 실제 원인을 서버 로그(pm2 logs)로
 * 확인하기 위한 최소한의 수집용 엔드포인트. DB 저장 없이 콘솔에만 남긴다.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY = 16 * 1024; // 16KB 초과 페이로드는 버린다

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > MAX_BODY) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const data = JSON.parse(text);
    // pm2 logs 에서 grep 하기 쉽도록 한 줄 프리픽스 고정
    console.error(
      "[client-error]",
      JSON.stringify({
        at: new Date().toISOString(),
        boundary: String(data?.boundary ?? "").slice(0, 20),
        name: String(data?.name ?? "").slice(0, 200),
        message: String(data?.message ?? "").slice(0, 1000),
        digest: data?.digest ?? null,
        url: String(data?.url ?? "").slice(0, 500),
        ua: String(data?.ua ?? "").slice(0, 300),
        chunkReloadCount: data?.chunkReloadCount ?? 0,
        stack: String(data?.stack ?? "").slice(0, 4000),
      })
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
