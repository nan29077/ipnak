export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// 주소 → 좌표 변환 프록시 (Nominatim, 서버에서 User-Agent 포함)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&accept-language=ko`,
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
