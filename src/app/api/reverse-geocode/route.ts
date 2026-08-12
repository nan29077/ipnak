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

type ReverseResult = { name: string | null; source: "kakao" | "openstreetmap" | null };

async function reverseWithKakao(lat: number, lng: number, key: string): Promise<ReverseResult> {
  if (!key) return { name: null, source: null };
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { name: null, source: null };
    const json = await res.json();
    const doc = json?.documents?.[0];
    const name = doc?.address?.address_name ?? doc?.road_address?.address_name ?? null;
    return { name, source: name ? "kakao" : null };
  } catch {
    return { name: null, source: null };
  }
}

/**
 * 카카오 REST 키가 없거나 일시적으로 실패한 환경의 보조 경로.
 * 앱에서 이미 주소 검색에 사용하는 Nominatim을 서버에서만 호출하고,
 * GPS 흔들림으로 동일 장소 요청이 늘지 않도록 좌표를 약 10m 단위로 캐시한다.
 */
async function reverseWithOpenStreetMap(lat: number, lng: number): Promise<ReverseResult> {
  const roundedLat = lat.toFixed(4);
  const roundedLng = lng.toFixed(4);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${roundedLat}&lon=${roundedLng}&format=jsonv2&zoom=16&addressdetails=1&accept-language=ko`,
      {
        headers: { "User-Agent": "ipnak-fishing-app/1.0 (contact: admin@ipnak.app)" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return { name: null, source: null };
    const json = await res.json();
    const address = json?.address ?? {};
    const parts = [
      address.state,
      address.city ?? address.county,
      address.borough ?? address.town ?? address.city_district,
      address.suburb ?? address.village ?? address.neighbourhood,
      address.road,
    ].filter((value, index, values) => value && values.indexOf(value) === index);
    const name = parts.length ? parts.join(" ") : json?.display_name ?? null;
    return { name, source: name ? "openstreetmap" : null };
  } catch {
    return { name: null, source: null };
  }
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ name: null }, { status: 400 });
  }

  const kakao = await reverseWithKakao(lat, lng, kakaoRestKey());
  if (kakao.name) return NextResponse.json(kakao);

  return NextResponse.json(await reverseWithOpenStreetMap(lat, lng));
}
