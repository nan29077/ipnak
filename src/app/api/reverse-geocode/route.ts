export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// 좌표 → 주소명 역지오코딩 프록시 (카카오 로컬 API)
// 카카오 REST 키는 서버에만 둔다 — 클라이언트 번들(NEXT_PUBLIC_*)에 노출되면 키 도용이 가능하다.
// KAKAO_MAP_KEY(서버 전용)를 우선 사용하고, 미설정 환경에서는 기존 값으로 폴백해 동작을 유지한다.
function kakaoRestKey() {
  return (
    process.env.KAKAO_MAP_KEY ||
    process.env.KAKAO_REST_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ||
    ""
  );
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ name: null }, { status: 400 });
  }

  const key = kakaoRestKey();
  if (!key) return NextResponse.json({ name: null });

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return NextResponse.json({ name: null });
    const json = await res.json();
    const doc = json?.documents?.[0];
    const name = doc?.address?.address_name ?? doc?.road_address?.address_name ?? null;
    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ name: null });
  }
}
