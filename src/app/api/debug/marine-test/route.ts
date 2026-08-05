/**
 * 해양 API 연결 진단용 엔드포인트 (개발/운영 모두 사용 가능)
 * GET /api/debug/marine-test?lat=37.45&lng=126.59
 */
import { NextRequest, NextResponse } from "next/server";
import { getMarineCredentials } from "@/lib/aiCredentials";

const KST = 9 * 3600_000;
function kstYmd() {
  const d = new Date(Date.now() + KST);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function testUrl(url: string, label: string) {
  const maskedUrl = url.replace(/(serviceKey=)[^&]*/i, "$1***");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const text = await res.text().catch(() => "");
    const trimmed = text.trim();
    const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
    const isXml = trimmed.startsWith("<");
    let parsed: any = null;
    let parseError: string | null = null;
    if (isJson) {
      try { parsed = JSON.parse(trimmed); } catch (e: any) { parseError = e?.message; }
    }
    return {
      label,
      url: maskedUrl,
      status: res.status,
      format: isJson ? "json" : isXml ? "xml" : "other",
      bodyPreview: trimmed.slice(0, 400),
      isJson,
      parsed: parsed ? "OK" : null,
      parseError,
      bodyLength: text.length,
    };
  } catch (e: any) {
    return { label, url: maskedUrl, error: `${e?.name}: ${e?.message}` };
  }
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "37.4517");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "126.5924");

  const creds = await getMarineCredentials().catch(() => ({ tideApiKey: "", weatherApiKey: "" }));
  const tideKey = creds.tideApiKey;
  const weatherKey = creds.weatherApiKey;
  const date = kstYmd();

  const results: any[] = [];

  if (!tideKey) {
    results.push({ label: "TIDE_API_KEY", error: "키 없음 — .env 또는 관리자 페이지에서 설정 필요" });
  } else {
    const encodedKey = encodeURIComponent(tideKey);
    const baseParams = `serviceKey=${encodedKey}&obsCode=DT_0001&date=${date}`;
    // tideObs (조석예보) — 가장 가능성 높은 동작 엔드포인트
    results.push(await testUrl(
      `https://apis.data.go.kr/1192136/tideObs/getTideObsPreTab?${baseParams}&ResultType=json&resultType=json&_type=json&numOfRows=10&pageNo=1&dataType=JSON`,
      "tideObs (obsCode=DT_0001, _type=json)"
    ));
    // dtRecent — 수온/기압/풍향
    results.push(await testUrl(
      `https://apis.data.go.kr/1192136/dtRecent/getObsDtRecent?${baseParams}&ResultType=json&resultType=json&_type=json&numOfRows=10&pageNo=1&dataType=JSON`,
      "dtRecent (obsCode=DT_0001, _type=json)"
    ));
    // dtRecent with numeric obsCode
    const numKey = `serviceKey=${encodedKey}&obsCode=0001&date=${date}`;
    results.push(await testUrl(
      `https://apis.data.go.kr/1192136/dtRecent/getObsDtRecent?${numKey}&ResultType=json&resultType=json&_type=json&numOfRows=10&pageNo=1&dataType=JSON`,
      "dtRecent (obsCode=0001 numeric)"
    ));
    // dtRecent without operation path
    results.push(await testUrl(
      `https://apis.data.go.kr/1192136/dtRecent?${baseParams}&ResultType=json&resultType=json&_type=json&numOfRows=10&pageNo=1&dataType=JSON`,
      "dtRecent base URL (no operation)"
    ));
  }

  if (!weatherKey) {
    results.push({ label: "WEATHER_API_KEY", error: "키 없음" });
  } else {
    const encodedKey = encodeURIComponent(weatherKey);
    // KMA 초단기실황 — nx=55, ny=127 (서울 근처)
    results.push(await testUrl(
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodedKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${date}&base_time=0600&nx=55&ny=127`,
      "KMA 기상청 초단기실황 (getUltraSrtNcst)"
    ));
  }

  return NextResponse.json({
    date,
    lat,
    lng,
    tideKeyLength: tideKey?.length ?? 0,
    weatherKeyLength: weatherKey?.length ?? 0,
    results,
  }, { status: 200 });
}
