export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getWeatherNowcast } from "@/lib/marineData";

/**
 * 계측 저장 시 기록할 현재 날씨 (위경도 기준).
 * 기상청 키는 서버에만 두고(WEATHER_API_KEY / 관리자 설정) 브라우저에는 노출하지 않는다.
 * 어떤 이유로든 조회에 실패하면 null 을 돌려주고, 측정 저장 흐름은 그대로 진행된다.
 */
const NULL_RESULT = { weather: null, temperature: null, source: null };

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(NULL_RESULT);
  }
  try {
    return NextResponse.json(await getWeatherNowcast(lat, lng));
  } catch {
    return NextResponse.json(NULL_RESULT);
  }
}
