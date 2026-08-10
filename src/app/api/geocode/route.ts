export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// 주소 → 좌표 변환 프록시 (Nominatim, 서버에서 User-Agent 포함)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(10, Math.max(1, limitRaw)) : 3;
  // 국가 코드 화이트리스트 — 임의 값을 그대로 외부 API 에 흘리지 않는다
  const cc = req.nextUrl.searchParams.get("countrycodes") === "kr" ? "&countrycodes=kr" : "";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}${cc}&accept-language=ko`,
      {
        headers: { "User-Agent": "ipnak-fishing-app/1.0 (contact: admin@ipnak.app)" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
