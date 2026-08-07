import "server-only";
import { getMarineCredentials } from "@/lib/aiCredentials";
import { distanceMeters } from "@/lib/map";

/**
 * AI 포인트 추천 보강용 해양·기상 데이터 수집기.
 *
 * 데이터 출처 (모두 공공데이터포털 apis.data.go.kr — 인증키 1개 공용)
 *  - 물때/조석(고조·저조) : 조위관측소 조석예보 `tideObs/getTideObsPreTab`
 *  - 수온 / 기압 / 해상 풍향·풍속 : 조위관측소 최신관측 `dtRecent/getObsDtRecent` (한 번 호출로 전 항목)
 *  - 육상 기온·풍향·풍속·습도 : 기상청 단기예보 초단기실황(getUltraSrtNcst)
 *
 * 설계 원칙 — **부분 실패 허용**
 *  키가 없거나(관리자가 아직 등록 안 함) 호출이 실패하면 그 항목만 null 로 두고 나머지는 그대로 내려간다.
 *  호출부(AI 추천)는 어떤 항목이 비어도 동작해야 한다. 여기서 throw 하지 않는다.
 */

// ===== 타입 =====

export type TideEvent = {
  /** ISO 문자열 (KST 기준 시각) */
  time: string;
  /** 표시용 HH:MM */
  label: string;
  kind: "high" | "low";
  levelCm: number | null;
};

export type TideInfo = {
  stationName: string;
  stationCode: string;
  distanceKm: number;
  /** 오늘 고조·저조 전체 (시간순) */
  events: TideEvent[];
  prev: TideEvent | null;
  next: TideEvent | null;
  /** 지금이 밀물인지 썰물인지 */
  phase: "밀물" | "썰물" | null;
  /** 직전 이벤트 → 다음 이벤트 사이 진행도 0~1 */
  progress: number;
  /** 물때 (예: "7물", "조금") — 음력 기반 근사치 */
  mulddae: string | null;
  /** 음력 일자 (근사치) */
  lunarDay: number | null;
};

export type WaterTempInfo = {
  stationName: string;
  distanceKm: number;
  tempC: number;
  observedAt: string | null;
};

export type WindInfo = {
  /** 기상학적 풍향(도) — 바람이 불어오는 방향 */
  deg: number | null;
  /** N / NE / E / SE / S / SW / W / NW */
  code: string | null;
  /** 북 / 북동 / 동 ... */
  label: string | null;
  speedMs: number | null;
  /** 체감 표현 (약한 바람 / 보통 / 강함 / 매우 강함) */
  strength: string | null;
  source: string;
};

export type PressureInfo = {
  hpa: number;
  trend: "rising" | "falling" | "stable";
  /** 최근 3시간 변화량(hPa) */
  changeHpa: number | null;
  source: string;
};

export type AirInfo = {
  tempC: number | null;
  humidity: number | null;
  /** 강수형태 문자열 (없음/비/비눈/눈/소나기) */
  precipitation: string | null;
  /** 1시간 강수량(mm) — KMA RN1. 강수 없음이면 0 또는 null */
  rainMm: number | null;
  source: string;
};

export type WaveInfo = {
  /** 유효파고 (m) */
  heightM: number;
  /** 파주기 (초) */
  periodS: number | null;
  /** 파향 (도, 기상학적: 파도가 오는 방향) */
  directionDeg: number | null;
  /** 파향 한글 (북/북동/동 ...) */
  directionLabel: string | null;
  source: string;
};

export type MarineSnapshot = {
  lat: number;
  lng: number;
  /** 관측소가 너무 멀어 바다 데이터가 의미 없는 내륙 지점 */
  inland: boolean;
  tide: TideInfo | null;
  waterTemp: WaterTempInfo | null;
  wind: WindInfo | null;
  pressure: PressureInfo | null;
  air: AirInfo | null;
  /** Open-Meteo Marine — 파고·파주기·파향 (키 불필요) */
  wave: WaveInfo | null;
  /** 수온 기준 어종 적합도 (수온이 있을 때만) */
  speciesFit: SpeciesFit[];
  configured: { tide: boolean; weather: boolean };
  /** 사용자/AI 에게 보여줄 수집 상태 메모 */
  notes: string[];
  fetchedAt: string;
};

export type SpeciesFit = {
  name: string;
  water: "민물" | "바다";
  /** 최적 / 양호 / 보통 / 비활성 */
  status: "최적" | "양호" | "보통" | "비활성";
};

// ===== 상수 =====

/**
 * 조위관측소 최신 관측데이터 — 조위·수온·기온·기압·풍향·풍속을 한 번에 준다.
 * data.go.kr 은 서비스마다 오퍼레이션 경로가 붙는 형태(`.../dtRecent/getObsDtRecent`)와
 * 베이스 URL 자체가 엔드포인트인 형태(`.../dtRecent`)가 섞여 있어 순서대로 시도한다.
 */
const DT_RECENT_ENDPOINTS = [
  "https://apis.data.go.kr/1192136/dtRecent/getObsDtRecent",
  "https://apis.data.go.kr/1192136/dtRecent",
];
/** 조위관측소 조석예보(고조·저조 시각표) — 위와 같은 이유로 폴백 경로를 함께 둔다. */
const TIDE_PRE_TAB_ENDPOINTS = [
  "https://apis.data.go.kr/1192136/tideObs/getTideObsPreTab",
  "https://apis.data.go.kr/1192136/tideObs",
];
const KMA_NCST = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
/** Open-Meteo — 무료·키 불필요. 기압(surface_pressure) 및 해수면 온도(sea_surface_temperature) 제공 */
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_MARINE = "https://marine-api.open-meteo.com/v1/marine";
const FETCH_TIMEOUT = 6000;
/** 이 거리를 넘으면 해양 관측소 데이터를 쓰지 않는다 (내륙 저수지 등) */
const MAX_STATION_KM = 60;

/**
 * 국립해양조사원 조위관측소(주요 지점).
 * 실제 운영 코드/좌표는 KHOA 공식 관측소 목록 기준이며, 신규 관측소가 생기면 여기에 추가하면 된다.
 * 표에 없는 지역은 가장 가까운 관측소로 대체되고, MAX_STATION_KM 를 넘으면 조석 데이터를 생략한다.
 */
export const TIDE_STATIONS: { code: string; name: string; lat: number; lng: number }[] = [
  { code: "DT_0001", name: "인천", lat: 37.4517, lng: 126.5924 },
  { code: "DT_0002", name: "평택", lat: 36.9664, lng: 126.8222 },
  { code: "DT_0003", name: "영광", lat: 35.4264, lng: 126.4194 },
  { code: "DT_0004", name: "진도", lat: 34.3775, lng: 126.3086 },
  { code: "DT_0005", name: "제주", lat: 33.5275, lng: 126.5430 },
  { code: "DT_0006", name: "부산", lat: 35.0964, lng: 129.0350 },
  { code: "DT_0007", name: "묵호", lat: 37.5500, lng: 129.1164 },
  { code: "DT_0008", name: "목포", lat: 34.7797, lng: 126.3753 },
  { code: "DT_0009", name: "안산", lat: 37.1922, lng: 126.6472 },
  { code: "DT_0010", name: "서귀포", lat: 33.2400, lng: 126.5617 },
  { code: "DT_0011", name: "여수", lat: 34.7472, lng: 127.7658 },
  { code: "DT_0012", name: "완도", lat: 34.3153, lng: 126.7592 },
  { code: "DT_0013", name: "군산", lat: 35.9753, lng: 126.5631 },
  { code: "DT_0016", name: "후포", lat: 36.6772, lng: 129.4536 },
  { code: "DT_0017", name: "대산", lat: 37.0072, lng: 126.3522 },
  { code: "DT_0018", name: "통영", lat: 34.8275, lng: 128.4344 },
  { code: "DT_0020", name: "보령", lat: 36.4067, lng: 126.4864 },
  { code: "DT_0021", name: "속초", lat: 38.2069, lng: 128.5947 },
  { code: "DT_0022", name: "고흥발포", lat: 34.4808, lng: 127.3419 },
  { code: "DT_0023", name: "강화대교", lat: 37.7311, lng: 126.5222 },
  { code: "DT_0024", name: "삼천포", lat: 34.9242, lng: 128.0694 },
  { code: "DT_0025", name: "거문도", lat: 34.0281, lng: 127.3078 },
  { code: "DT_0026", name: "거제도", lat: 34.8017, lng: 128.6989 },
  { code: "DT_0027", name: "성산포", lat: 33.4744, lng: 126.9275 },
  { code: "DT_0028", name: "추자도", lat: 33.9617, lng: 126.3000 },
  { code: "DT_0029", name: "울릉도", lat: 37.4914, lng: 130.9133 },
  { code: "DT_0031", name: "흑산도", lat: 34.6844, lng: 125.4358 },
  { code: "DT_0035", name: "어청도", lat: 36.1167, lng: 125.9833 },
  { code: "DT_0036", name: "위도", lat: 35.6194, lng: 126.3006 },
  { code: "DT_0038", name: "인천송도", lat: 37.3383, lng: 126.5872 },
  { code: "DT_0043", name: "서천마량", lat: 36.1367, lng: 126.4906 },
  { code: "DT_0044", name: "태안", lat: 36.9133, lng: 126.2383 },
  { code: "DT_0047", name: "부산항신항", lat: 35.0217, lng: 128.7981 },
  { code: "DT_0056", name: "진해", lat: 35.1000, lng: 128.6667 },
  { code: "DT_0063", name: "마산", lat: 35.1975, lng: 128.5764 },
];

/**
 * 관측소별 M2 조석 파라미터 — 달의 자오선 통과 후 만조까지의 위상 지연(시간)과 평균 진폭(cm).
 * KHOA 공개 조화상수 기반 근사치. 알고리즘 물때 계산에 사용. 오차 약 ±0.5~2h.
 */
const STATION_TIDE_PARAMS: Record<string, { phaseLagH: number; amplitudeCm: number }> = {
  DT_0001: { phaseLagH: 5.5, amplitudeCm: 410 },  // 인천
  DT_0002: { phaseLagH: 6.0, amplitudeCm: 390 },  // 평택
  DT_0003: { phaseLagH: 4.8, amplitudeCm: 250 },  // 영광
  DT_0004: { phaseLagH: 5.0, amplitudeCm: 230 },  // 진도
  DT_0005: { phaseLagH: 4.5, amplitudeCm: 80 },   // 제주
  DT_0006: { phaseLagH: 5.8, amplitudeCm: 70 },   // 부산
  DT_0007: { phaseLagH: 10.0, amplitudeCm: 15 },  // 묵호
  DT_0008: { phaseLagH: 4.5, amplitudeCm: 290 },  // 목포
  DT_0009: { phaseLagH: 5.8, amplitudeCm: 380 },  // 안산
  DT_0010: { phaseLagH: 4.5, amplitudeCm: 85 },   // 서귀포
  DT_0011: { phaseLagH: 5.2, amplitudeCm: 130 },  // 여수
  DT_0012: { phaseLagH: 4.8, amplitudeCm: 200 },  // 완도
  DT_0013: { phaseLagH: 5.2, amplitudeCm: 360 },  // 군산
  DT_0016: { phaseLagH: 9.8, amplitudeCm: 30 },   // 후포
  DT_0017: { phaseLagH: 5.8, amplitudeCm: 350 },  // 대산
  DT_0018: { phaseLagH: 7.0, amplitudeCm: 110 },  // 통영
  DT_0020: { phaseLagH: 5.5, amplitudeCm: 340 },  // 보령
  DT_0021: { phaseLagH: 10.5, amplitudeCm: 12 },  // 속초
  DT_0022: { phaseLagH: 5.0, amplitudeCm: 155 },  // 고흥발포
  DT_0023: { phaseLagH: 5.8, amplitudeCm: 415 },  // 강화대교
  DT_0024: { phaseLagH: 6.5, amplitudeCm: 100 },  // 삼천포
  DT_0025: { phaseLagH: 5.0, amplitudeCm: 140 },  // 거문도
  DT_0026: { phaseLagH: 6.2, amplitudeCm: 80 },   // 거제도
  DT_0027: { phaseLagH: 4.8, amplitudeCm: 85 },   // 성산포
  DT_0028: { phaseLagH: 4.8, amplitudeCm: 100 },  // 추자도
  DT_0029: { phaseLagH: 8.0, amplitudeCm: 10 },   // 울릉도
  DT_0031: { phaseLagH: 4.5, amplitudeCm: 210 },  // 흑산도
  DT_0035: { phaseLagH: 4.8, amplitudeCm: 210 },  // 어청도
  DT_0036: { phaseLagH: 5.0, amplitudeCm: 270 },  // 위도
  DT_0038: { phaseLagH: 5.7, amplitudeCm: 400 },  // 인천송도
  DT_0043: { phaseLagH: 5.3, amplitudeCm: 310 },  // 서천마량
  DT_0044: { phaseLagH: 5.5, amplitudeCm: 350 },  // 태안
  DT_0047: { phaseLagH: 5.8, amplitudeCm: 65 },   // 부산항신항
  DT_0056: { phaseLagH: 6.5, amplitudeCm: 95 },   // 진해
  DT_0063: { phaseLagH: 7.0, amplitudeCm: 90 },   // 마산
};

/**
 * 어종별 활성 수온대 (섭씨).
 * best 구간이 가장 활발하고, [min,max] 밖이면 입질이 크게 떨어진다.
 * 낚시 일반론 기준의 대략치이며 지역·시기에 따라 달라질 수 있다.
 */
const SPECIES_TEMP: { name: string; water: "민물" | "바다"; min: number; max: number; best: [number, number] }[] = [
  { name: "배스", water: "민물", min: 10, max: 32, best: [18, 25] },
  { name: "붕어", water: "민물", min: 8, max: 30, best: [15, 23] },
  { name: "잉어", water: "민물", min: 8, max: 32, best: [18, 26] },
  { name: "쏘가리", water: "민물", min: 14, max: 30, best: [20, 26] },
  { name: "가물치", water: "민물", min: 15, max: 32, best: [22, 28] },
  { name: "송어", water: "민물", min: 3, max: 19, best: [8, 15] },
  { name: "빙어", water: "민물", min: 0, max: 10, best: [1, 5] },
  { name: "감성돔", water: "바다", min: 8, max: 25, best: [12, 20] },
  { name: "참돔", water: "바다", min: 12, max: 27, best: [16, 23] },
  { name: "농어", water: "바다", min: 8, max: 27, best: [14, 22] },
  { name: "광어", water: "바다", min: 9, max: 25, best: [14, 21] },
  { name: "우럭(조피볼락)", water: "바다", min: 5, max: 23, best: [10, 18] },
  { name: "볼락", water: "바다", min: 5, max: 20, best: [8, 15] },
  { name: "숭어", water: "바다", min: 8, max: 29, best: [14, 24] },
  { name: "갈치", water: "바다", min: 15, max: 29, best: [20, 27] },
  { name: "고등어", water: "바다", min: 14, max: 28, best: [17, 24] },
  { name: "벵에돔", water: "바다", min: 14, max: 29, best: [18, 25] },
  { name: "돌돔", water: "바다", min: 15, max: 29, best: [20, 26] },
  { name: "방어", water: "바다", min: 9, max: 23, best: [12, 19] },
  { name: "무늬오징어", water: "바다", min: 14, max: 28, best: [18, 25] },
  { name: "주꾸미", water: "바다", min: 13, max: 27, best: [18, 24] },
  { name: "문어", water: "바다", min: 9, max: 25, best: [13, 20] },
];

// ===== 유틸 =====

/** 모듈 단위 TTL 캐시 — 같은 지역을 여러 회원이 조회해도 공공 API 호출을 아낀다. */
const cache = new Map<string, { at: number; value: unknown }>();
async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  // 실패(null)는 캐시하지 않는다 — 일시적 오류가 TTL 동안 굳어 카드가 계속 비는 걸 막는다.
  if (value != null) {
    cache.set(key, { at: Date.now(), value });
    // 캐시가 무한정 자라지 않도록 오래된 항목 정리
    if (cache.size > 200) {
      for (const [k, v] of cache) if (Date.now() - v.at > 6 * 3600_000) cache.delete(k);
    }
  }
  return value;
}

/** 로그에 인증키가 그대로 찍히지 않도록 serviceKey 값을 가린다. */
function maskUrl(url: string) {
  return url.replace(/(serviceKey=)[^&]*/i, "$1***");
}

const DEBUG_PREFIX = "[ipnak][marine]";

/**
 * KHOA XML 응답 → data.go.kr 표준 JSON 구조로 변환.
 * data.go.kr 의 KHOA API 는 _type=json 을 명시해도 XML 로 응답하는 경우가 있어,
 * XML 폴백 파싱을 통해 <item> 블록에서 필드를 추출한다.
 */
function xmlToKhoaJson(xml: string): any | null {
  try {
    // 오류 코드 확인 — 00 이 아니면 서비스 오류
    const codeMatch = xml.match(/<resultCode[^>]*>([^<]*)<\/resultCode>/i);
    const code = codeMatch?.[1]?.trim();
    if (code && code !== "00" && code !== "0000") {
      const msgMatch = xml.match(/<resultMsg[^>]*>([^<]*)<\/resultMsg>/i);
      console.log(`${DEBUG_PREFIX} XML resultCode=${code} msg=${msgMatch?.[1]?.trim() ?? "?"}`);
      return null;
    }
    // <item> 블록 추출
    const items: Record<string, string>[] = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[1];
      const row: Record<string, string> = {};
      const fieldRe = /<([A-Za-z0-9_]+)[^>]*>([^<]*)<\/\1>/g;
      let fm;
      while ((fm = fieldRe.exec(block)) !== null) {
        row[fm[1]] = fm[2].trim();
      }
      if (Object.keys(row).length > 0) items.push(row);
    }
    if (items.length === 0) return null;
    return { response: { body: { items: { item: items.length === 1 ? items[0] : items } } } };
  } catch {
    return null;
  }
}

/**
 * 공공 API 호출 + 진단 로그.
 * 어떤 URL 로 호출했고, 상태코드가 뭐였고, 본문 앞 500자가 어땠는지 남긴다.
 * data.go.kr 은 잘못된 오퍼레이션/키일 때도 200 + XML 로 응답하므로, JSON 과 XML 모두 파싱한다.
 */
async function getJson(url: string, label = "api"): Promise<any | null> {
  const started = Date.now();
  try {
    console.log(`${DEBUG_PREFIX} ${label} → GET ${maskUrl(url)}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT), cache: "no-store" });
    const text = await res.text().catch(() => "");
    console.log(
      `${DEBUG_PREFIX} ${label} ← HTTP ${res.status} (${Date.now() - started}ms, ${text.length}b) ${text.slice(0, 300)}`,
    );
    if (!res.ok) return null;
    const trimmed = text.trim();
    // JSON 응답
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (e: any) {
        console.log(`${DEBUG_PREFIX} ${label} ! JSON 파싱 실패: ${e?.message || "parse error"}`);
        return null;
      }
    }
    // XML 응답 — KHOA API 는 _type=json 지정 시에도 XML 로 내려오는 경우가 있다.
    if (trimmed.startsWith("<")) {
      const parsed = xmlToKhoaJson(trimmed);
      if (parsed) {
        const rows = khoaRows(parsed);
        console.log(`${DEBUG_PREFIX} ${label} ✓ XML→JSON 변환 성공 rows=${rows.length}`);
        return parsed;
      }
      console.log(`${DEBUG_PREFIX} ${label} ! XML 응답이지만 item 데이터 없음`);
      return null;
    }
    console.log(`${DEBUG_PREFIX} ${label} ! 알 수 없는 응답 형식`);
    return null;
  } catch (e: any) {
    console.log(`${DEBUG_PREFIX} ${label} ! 호출 실패 (${Date.now() - started}ms): ${e?.name || "error"} ${e?.message || ""}`);
    return null;
  }
}

/**
 * 엔드포인트 후보를 순서대로 호출해 **행이 실제로 들어있는** 첫 응답을 돌려준다.
 * 200 이지만 빈 결과/에러 바디인 경우도 다음 후보로 넘어간다.
 */
async function getJsonWithFallback(
  endpoints: string[],
  query: string,
  label: string,
): Promise<any | null> {
  for (let i = 0; i < endpoints.length; i++) {
    const url = `${endpoints[i]}${query}`;
    const json = await getJson(url, `${label}#${i + 1}`);
    if (!json) continue;
    const rows = khoaRows(json);
    if (rows.length > 0) {
      console.log(`${DEBUG_PREFIX} ${label}#${i + 1} ✓ rows=${rows.length} keys=${Object.keys(rows[0] ?? {}).join(",")}`);
      return json;
    }
    console.log(`${DEBUG_PREFIX} ${label}#${i + 1} ✗ 응답은 왔지만 사용할 행이 없어 다음 경로를 시도합니다.`);
  }
  console.log(`${DEBUG_PREFIX} ${label} ✗ 모든 엔드포인트 실패`);
  return null;
}

/** 응답 필드명이 문서/버전마다 달라서 후보 키를 순회하며 숫자를 뽑는다. */
function pickNum(obj: any, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/[^\d.\-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickStr(obj: any, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * 관측 데이터의 위치가 스펙마다 다른 걸 흡수한다.
 *  - 공공데이터포털 표준 : response.body.items.item (배열 또는 단일 객체)
 *  - 기존 KHOA 스펙      : result.data / data / result
 */
function khoaRows(json: any): any[] {
  const candidates = [
    json?.response?.body?.items?.item,
    json?.response?.body?.items,
    json?.response?.body?.item,
    json?.response?.body?.data,
    json?.response?.body,
    json?.body?.items?.item,
    json?.body?.items,
    json?.body?.item,
    json?.items?.item,
    json?.items,
    json?.item,
    json?.result?.data?.data,
    json?.result?.data,
    json?.result?.items?.item,
    json?.result?.item,
    json?.data?.item,
    json?.data,
    json?.result,
    json?.list,
    Array.isArray(json) ? json : null,
  ];
  for (const d of candidates) {
    const rows = asRows(d);
    if (rows.length) return rows;
  }
  // 위 후보에 없으면 구조가 또 바뀐 것 — 객체 배열을 얕은 깊이로 탐색해 마지막 방어선을 둔다.
  return deepFindRows(json, 0);
}

/** 응답 껍데기(페이지 정보·결과코드)에만 쓰이는 키 — 이것만 있는 객체는 관측행이 아니다. */
const ENVELOPE_KEYS = new Set([
  "totalCount", "pageNo", "numOfRows", "resultCode", "resultMsg", "returnCode", "returnAuthMsg",
  "header", "body", "items", "item", "data", "result", "response", "list", "count", "meta",
]);

/** 값이 "관측행"으로 쓸 만한지 판별 — 배열이면 객체만 추리고, 단일 객체면 실제 데이터 필드가 있어야 한다. */
function asRows(d: any): any[] {
  if (Array.isArray(d)) {
    return d.filter((r) => r && typeof r === "object" && !Array.isArray(r));
  }
  if (d && typeof d === "object") {
    const hasDataField = Object.entries(d).some(
      ([k, v]) => !ENVELOPE_KEYS.has(k) && (typeof v === "string" || typeof v === "number"),
    );
    return hasDataField ? [d] : [];
  }
  return [];
}

/** 응답 스펙이 예상 밖일 때를 위한 얕은 재귀 탐색 (깊이 4 제한, 첫 객체 배열 채택) */
function deepFindRows(node: any, depth: number): any[] {
  if (!node || typeof node !== "object" || depth > 4) return [];
  if (Array.isArray(node)) {
    const rows = node.filter((r) => r && typeof r === "object" && !Array.isArray(r));
    if (rows.length) return rows;
    return [];
  }
  for (const v of Object.values(node)) {
    const found = deepFindRows(v, depth + 1);
    if (found.length) return found;
  }
  return [];
}

// ===== KST 시간 =====

const KST_OFFSET_MS = 9 * 3600_000;
function kstNow() { return new Date(Date.now() + KST_OFFSET_MS); }
function kstYmd(d = kstNow()) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** "2026-08-05 13:24:00" / "202608051324" 형태를 KST 기준 Date 로 파싱 */
function parseKstTime(raw: string | null): Date | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 12) return null;
  const [y, mo, d, h, mi] = [
    Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)), Number(digits.slice(10, 12)),
  ];
  const ms = Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function hhmm(date: Date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

// ===== 물때 (음력 근사) =====

/** 2000-01-06 18:14 UTC 삭(신월) 기준 평균 삭망월로 음력 일자를 근사한다. */
function approximateLunarDay(date = new Date()): number {
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC = 29.530588853;
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86400_000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  return Math.floor(age) + 1; // 1~30
}

/** 서해안 7물때식 — 음력 일자 → 물때 이름 */
const MULDDAE_TABLE = [
  "7물", "8물", "9물", "10물", "11물", "12물", "13물", "조금", "무시",
  "1물", "2물", "3물", "4물", "5물", "6물",
];
function mulddaeOf(lunarDay: number): string {
  const idx = (lunarDay - 1) % 15;
  return MULDDAE_TABLE[idx] ?? "";
}

// ===== 풍향 =====

const WIND_CODES = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const WIND_LABELS = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"];

export function windCodeOf(deg: number) {
  const i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return { code: WIND_CODES[i], label: WIND_LABELS[i] };
}

function windStrength(ms: number) {
  if (ms < 1.6) return "고요";
  if (ms < 3.4) return "약한 바람";
  if (ms < 5.5) return "보통";
  if (ms < 8.0) return "다소 강함";
  if (ms < 10.8) return "강함";
  return "매우 강함";
}

// ===== 기상청 격자 변환 (dfs_xy_conv) =====

export function toKmaGrid(lat: number, lng: number) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/** 초단기실황은 매시 40분에 생성된다 — 안전하게 45분 이전이면 직전 시각을 쓴다. */
function ncstBase() {
  const k = kstNow();
  if (k.getUTCMinutes() < 45) k.setUTCHours(k.getUTCHours() - 1);
  return {
    base_date: `${k.getUTCFullYear()}${String(k.getUTCMonth() + 1).padStart(2, "0")}${String(k.getUTCDate()).padStart(2, "0")}`,
    base_time: `${String(k.getUTCHours()).padStart(2, "0")}00`,
  };
}

// ===== 개별 수집기 =====

export function findNearestStation(lat: number, lng: number) {
  let best = TIDE_STATIONS[0];
  let bestD = Infinity;
  for (const s of TIDE_STATIONS) {
    const d = distanceMeters({ lat, lng }, { lat: s.lat, lng: s.lng });
    if (d < bestD) { bestD = d; best = s; }
  }
  return { station: best, distanceKm: Math.round(bestD / 100) / 10 };
}

async function fetchTide(key: string, lat: number, lng: number): Promise<TideInfo | null> {
  const { station, distanceKm } = findNearestStation(lat, lng);
  if (distanceKm > MAX_STATION_KM) return null;
  const date = kstYmd();

  const query = `?serviceKey=${encodeURIComponent(key)}&obsCode=${station.code}&date=${date}&_type=json&ResultType=json&resultType=json&numOfRows=100&pageNo=1&dataType=JSON`;
  const json = await memo(`tide:${station.code}:${date}`, 3 * 3600_000, () =>
    getJsonWithFallback(TIDE_PRE_TAB_ENDPOINTS, query, `tideObs ${station.name}`),
  );
  if (!json) return null;

  const events: TideEvent[] = [];
  for (const row of khoaRows(json)) {
    const t = parseKstTime(pickStr(row, ["tph_time", "tphTime", "record_time", "recordTime", "time"]));
    const hl = (pickStr(row, ["hl_code", "hlCode", "code"]) || "").toUpperCase();
    if (!t || !hl) continue;
    events.push({
      time: t.toISOString(),
      label: hhmm(t),
      kind: hl.startsWith("고") || hl === "H" || hl === "고조" ? "high" : "low",
      levelCm: pickNum(row, ["tph_level", "tphLevel", "level"]),
    });
  }
  if (events.length === 0) return null;
  events.sort((a, b) => a.time.localeCompare(b.time));

  const now = Date.now();
  let prev: TideEvent | null = null;
  let next: TideEvent | null = null;
  for (const e of events) {
    const t = new Date(e.time).getTime();
    if (t <= now) prev = e;
    else if (!next) next = e;
  }

  let progress = 0;
  if (prev && next) {
    const a = new Date(prev.time).getTime();
    const b = new Date(next.time).getTime();
    progress = b > a ? Math.min(1, Math.max(0, (now - a) / (b - a))) : 0;
  } else if (next) progress = 0;
  else progress = 1;

  // 다음이 고조면 지금은 물이 차오르는 밀물
  const phase: TideInfo["phase"] = next ? (next.kind === "high" ? "밀물" : "썰물") : null;
  const lunarDay = approximateLunarDay();

  return {
    stationName: station.name,
    stationCode: station.code,
    distanceKm,
    events,
    prev,
    next,
    phase,
    progress,
    mulddae: mulddaeOf(lunarDay),
    lunarDay,
  };
}

/** 최신 관측 1회 호출로 얻는 항목들 */
type DtRecentInfo = {
  waterTemp: WaterTempInfo | null;
  pressure: PressureInfo | null;
  wind: WindInfo | null;
};

const EMPTY_DT_RECENT: DtRecentInfo = { waterTemp: null, pressure: null, wind: null };

/**
 * 기압 추세용 관측소별 최근 기압 이력.
 * 최신관측 API 는 현재값만 주므로, 호출될 때마다 값을 쌓아 3시간 변화량을 근사한다.
 * (서버 재시작 시 초기화되며, 표본이 없으면 changeHpa 는 null 로 내려간다.)
 */
const pressureHistory = new Map<string, { t: number; v: number }[]>();
function trackPressure(code: string, t: number, v: number) {
  const series = pressureHistory.get(code) ?? [];
  if (!series.some((s) => s.t === t)) series.push({ t, v });
  series.sort((a, b) => a.t - b.t);
  const cutoff = t - 12 * 3600_000;
  const kept = series.filter((s) => s.t >= cutoff).slice(-48);
  pressureHistory.set(code, kept);
  return kept;
}

/**
 * 조위관측소 최신 관측데이터 — 수온·기압·해상풍을 한 번에 가져온다.
 * 실패하면 모든 항목이 null 인 객체를 돌려주며 throw 하지 않는다.
 */
async function fetchDtRecent(key: string, lat: number, lng: number): Promise<DtRecentInfo> {
  const { station, distanceKm } = findNearestStation(lat, lng);
  if (distanceKm > MAX_STATION_KM) return EMPTY_DT_RECENT;
  const date = kstYmd();

  // obsCode 형태 변형: "DT_0001" → "0001" → "1"
  const numericPart = station.code.replace("DT_", "");
  const numericStripped = String(parseInt(numericPart, 10));
  const obsCodeVariants = [
    station.code,      // "DT_0001"
    numericPart,       // "0001"
    numericStripped,   // "1"
  ];
  // 파라미터 키 형태 변형 (API 버전/문서마다 다름)
  const paramKeyVariants = ["obsCode", "ObsCode", "obs_code", "stationCode"];

  // 공통 파라미터 (numOfRows=10 을 먼저 시도, 일부 API에서 누락 시 거부)
  const baseParams = `serviceKey=${encodeURIComponent(key)}&date=${date}&_type=json&ResultType=json&resultType=json&numOfRows=10&pageNo=1&dataType=JSON`;

  const cacheKey = `dtrecent:${station.code}:${date}:${new Date().getUTCHours()}`;

  const json = await memo(cacheKey, 30 * 60_000, async () => {
    // obsCode × paramKey 조합을 순서대로 시도해 첫 성공 응답을 반환한다.
    for (const obsCode of obsCodeVariants) {
      for (const paramKey of paramKeyVariants) {
        const query = `?${baseParams}&${paramKey}=${obsCode}`;
        const label = `dtRecent ${station.name}(${paramKey}=${obsCode})`;
        const result = await getJsonWithFallback(DT_RECENT_ENDPOINTS, query, label);
        if (result) {
          const rows = khoaRows(result);
          if (rows.length > 0) {
            console.log(
              `${DEBUG_PREFIX} dtRecent ✓ 성공 파라미터: ${paramKey}=${obsCode}, rows=${rows.length}, keys=${Object.keys(rows[rows.length - 1] ?? {}).join(",")}`,
            );
            return result;
          }
        }
      }
    }
    console.log(
      `${DEBUG_PREFIX} dtRecent ✗ 모든 파라미터 조합 실패 (${obsCodeVariants.length * paramKeyVariants.length}가지 시도)`,
    );
    return null;
  });

  if (!json) return EMPTY_DT_RECENT;

  const rows = khoaRows(json);
  if (rows.length === 0) return EMPTY_DT_RECENT;
  // 배열이면 가장 최근 관측이 마지막에 오는 편이라 뒤에서부터 훑는다.
  const row = rows[rows.length - 1];

  const observedAt = parseKstTime(
    pickStr(row, ["record_time", "recordTime", "obs_time", "obsTime", "tphTime", "time"]),
  );

  // --- 수온 ---
  const temp = pickNum(row, ["water_temp", "waterTemp", "wt", "twd", "wtemp", "tw", "temp"]);
  const waterTemp: WaterTempInfo | null =
    temp != null && temp >= -5 && temp <= 40
      ? {
          stationName: station.name,
          distanceKm,
          tempC: Math.round(temp * 10) / 10,
          observedAt: observedAt ? observedAt.toISOString() : null,
        }
      : null;

  // --- 기압 ---
  const hpaRaw = pickNum(row, ["air_pres", "airPres", "air_press", "airPress", "pressure", "ap", "air_pressure", "atm_pres"]);
  let pressure: PressureInfo | null = null;
  if (hpaRaw != null && hpaRaw >= 900 && hpaRaw <= 1100) {
    const at = observedAt ? observedAt.getTime() : Date.now();
    const series = trackPressure(station.code, at, hpaRaw);
    const target = at - 3 * 3600_000;
    // 3시간 전 표본이 없으면 가지고 있는 가장 오래된 값으로 대체한다.
    let ref = series[0];
    for (const s of series) if (s.t <= target) ref = s;
    const change = ref ? Math.round((hpaRaw - ref.v) * 10) / 10 : null;
    pressure = {
      hpa: Math.round(hpaRaw * 10) / 10,
      trend: change == null ? "stable" : change >= 1 ? "rising" : change <= -1 ? "falling" : "stable",
      changeHpa: series.length > 1 && change != null ? change : null,
      source: `국립해양조사원 ${station.name}`,
    };
  }

  // --- 해상 풍향·풍속 ---
  const deg = pickNum(row, ["wind_dir", "windDir", "dir", "wd", "wind_direction"]);
  const speed = pickNum(row, ["wind_speed", "windSpeed", "speed", "ws", "wind_spd"]);
  const dir = deg != null ? windCodeOf(deg) : null;
  const wind: WindInfo | null =
    deg != null || speed != null
      ? {
          deg: deg != null ? Math.round(deg) : null,
          code: dir?.code ?? null,
          label: dir?.label ?? null,
          speedMs: speed != null ? Math.round(speed * 10) / 10 : null,
          strength: speed != null ? windStrength(speed) : null,
          source: `국립해양조사원 ${station.name}`,
        }
      : null;

  return { waterTemp, pressure, wind };
}

const PTY_LABEL: Record<string, string> = { "0": "없음", "1": "비", "2": "비/눈", "3": "눈", "4": "소나기", "5": "빗방울", "6": "빗방울눈날림", "7": "눈날림" };

async function fetchKmaNowcast(key: string, lat: number, lng: number): Promise<{ wind: WindInfo | null; air: AirInfo | null; pressure: PressureInfo | null }> {
  const { nx, ny } = toKmaGrid(lat, lng);
  const { base_date, base_time } = ncstBase();

  const json = await memo(`kma:${nx}:${ny}:${base_date}${base_time}`, 30 * 60_000, () =>
    getJson(
      `${KMA_NCST}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`,
      `kma ${nx},${ny}`,
    ),
  );
  const raw = json?.response?.body?.items?.item;
  const items: any[] = Array.isArray(raw) ? raw : khoaRows(json);
  if (items.length === 0) return { wind: null, air: null, pressure: null };

  const map = new Map<string, string>();
  for (const it of items) if (it?.category) map.set(String(it.category), String(it.obsrValue));

  const num = (k: string) => {
    const v = map.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const deg = num("VEC");
  const speed = num("WSD");
  const dir = deg != null ? windCodeOf(deg) : null;

  const wind: WindInfo | null = deg != null || speed != null
    ? {
        deg: deg != null ? Math.round(deg) : null,
        code: dir?.code ?? null,
        label: dir?.label ?? null,
        speedMs: speed != null ? Math.round(speed * 10) / 10 : null,
        strength: speed != null ? windStrength(speed) : null,
        source: "기상청 초단기실황",
      }
    : null;

  const t1h = num("T1H");
  const reh = num("REH");
  const pty = map.get("PTY");
  // RN1 은 mm 숫자이지만 "강수없음" 같은 문자열이 올 수 있어 num() 이 null 을 돌려주면 그대로 둔다.
  const rn1 = num("RN1");
  const air: AirInfo | null = t1h != null || reh != null
    ? {
        tempC: t1h,
        humidity: reh,
        precipitation: pty != null ? (PTY_LABEL[pty] ?? null) : null,
        rainMm: rn1 != null && rn1 >= 0 ? Math.round(rn1 * 10) / 10 : null,
        source: "기상청 초단기실황",
      }
    : null;

  return { wind, air, pressure: null };
}

/**
 * Open-Meteo 기압 조회 — 무료·키 불필요.
 * KMA getUltraSrtNcst 에는 기압(PS) 카테고리가 없으므로 별도로 호출한다.
 */
async function fetchOpenMeteoPressure(lat: number, lng: number): Promise<PressureInfo | null> {
  const url = `${OPEN_METEO_FORECAST}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=surface_pressure&timezone=Asia%2FSeoul`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT), cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const hpa = data?.current?.surface_pressure;
    if (typeof hpa !== "number" || hpa < 900 || hpa > 1100) return null;
    return {
      hpa: Math.round(hpa * 10) / 10,
      trend: "stable",
      changeHpa: null,
      source: "Open-Meteo",
    };
  } catch {
    return null;
  }
}

// ===== 알고리즘 조석 예측 =====

/**
 * 달의 자오선 통과 시각(Moon Upper Transit Time)을 근사한다.
 * 2000-01-07 02:28 UTC = 한국(127°E) 기준 약 11:28 KST — 신월 직후 달의 남중시각.
 * 이후 24시간 50.47분마다 반복된다.
 */
function latestMoonTransit(): number {
  const REF_TRANSIT_UTC = Date.UTC(2000, 0, 7, 2, 28);
  const TRANSIT_PERIOD_MS = (24 * 60 + 50.47) * 60_000;
  const now = Date.now();
  const n = Math.floor((now - REF_TRANSIT_UTC) / TRANSIT_PERIOD_MS);
  const t = REF_TRANSIT_UTC + n * TRANSIT_PERIOD_MS;
  return t > now ? t - TRANSIT_PERIOD_MS : t;
}

/**
 * KHOA API 없을 때 조석 이벤트를 천문조석 알고리즘으로 근사 계산한다.
 * M2 주조(주기 12.42h)만 사용하므로 오차 약 ±0.5~2h — 낚시 참고용으로 충분하다.
 */
function computeTideAlgorithm(
  station: (typeof TIDE_STATIONS)[0],
  distanceKm: number,
): TideInfo | null {
  const params = STATION_TIDE_PARAMS[station.code];
  if (!params) return null;

  const M2_PERIOD_MS = 12.420601 * 3600_000;
  const phaseLagMs = params.phaseLagH * 3600_000;
  const transit = latestMoonTransit();

  // 가장 최근 달 남중 이후 위상 지연을 더해 첫 만조 시각 산출
  const firstHighMs = transit + phaseLagMs;

  // 오늘(KST) 에 해당하는 이벤트를 수집
  const now = Date.now();
  const kstNow = new Date(now + KST_OFFSET_MS);
  const events: TideEvent[] = [];

  for (let i = -4; i <= 8; i++) {
    const highMs = firstHighMs + i * M2_PERIOD_MS;
    const lowMs = highMs + M2_PERIOD_MS / 2;
    for (const [tMs, kind] of [
      [highMs, "high" as const],
      [lowMs, "low" as const],
    ] as [number, "high" | "low"][]) {
      const kstDate = new Date(tMs + KST_OFFSET_MS);
      if (
        kstDate.getUTCFullYear() === kstNow.getUTCFullYear() &&
        kstDate.getUTCMonth() === kstNow.getUTCMonth() &&
        kstDate.getUTCDate() === kstNow.getUTCDate()
      ) {
        events.push({
          time: new Date(tMs).toISOString(),
          label: hhmm(new Date(tMs)),
          kind,
          levelCm: kind === "high" ? params.amplitudeCm : null,
        });
      }
    }
  }

  events.sort((a, b) => a.time.localeCompare(b.time));
  if (events.length === 0) return null;

  let prev: TideEvent | null = null;
  let next: TideEvent | null = null;
  for (const e of events) {
    const t = new Date(e.time).getTime();
    if (t <= now) prev = e;
    else if (!next) next = e;
  }

  let progress = 0;
  if (prev && next) {
    const a = new Date(prev.time).getTime();
    const b = new Date(next.time).getTime();
    progress = b > a ? Math.min(1, Math.max(0, (now - a) / (b - a))) : 0;
  }

  const lunarDay = approximateLunarDay();
  return {
    stationName: `${station.name} (근사)`,
    stationCode: station.code,
    distanceKm,
    events,
    prev,
    next,
    phase: next ? (next.kind === "high" ? "밀물" : "썰물") : null,
    progress,
    mulddae: mulddaeOf(lunarDay),
    lunarDay,
  };
}

// ===== Open-Meteo Marine (파고·파주기·파향·수온) =====

/**
 * Open-Meteo Marine API — 무료·키 불필요.
 * 파고(m)·파주기(초)·파향(도)·해수면온도(℃) 를 한 번에 가져온다.
 * KHOA API 대안으로 수온 폴백 및 파고 데이터 제공용.
 */
async function fetchOpenMeteoMarine(
  lat: number,
  lng: number,
): Promise<{ wave: WaveInfo | null; waterTemp: WaterTempInfo | null }> {
  const url =
    `${OPEN_METEO_MARINE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=Asia%2FSeoul`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT), cache: "no-store" });
    if (!res.ok) return { wave: null, waterTemp: null };
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return { wave: null, waterTemp: null };

    const wh: number | null = typeof cur.wave_height === "number" ? cur.wave_height : null;
    const wp: number | null = typeof cur.wave_period === "number" ? cur.wave_period : null;
    const wd: number | null = typeof cur.wave_direction === "number" ? cur.wave_direction : null;
    const sst: number | null = typeof cur.sea_surface_temperature === "number" ? cur.sea_surface_temperature : null;

    const wave: WaveInfo | null =
      wh != null && wh >= 0
        ? {
            heightM: Math.round(wh * 10) / 10,
            periodS: wp != null ? Math.round(wp * 10) / 10 : null,
            directionDeg: wd != null ? Math.round(wd) : null,
            directionLabel: wd != null ? windCodeOf(wd).label : null,
            source: "Open-Meteo Marine",
          }
        : null;

    const waterTemp: WaterTempInfo | null =
      sst != null && sst > -5 && sst < 50
        ? {
            stationName: "Open-Meteo",
            distanceKm: 0,
            tempC: Math.round(sst * 10) / 10,
            observedAt: null,
          }
        : null;

    return { wave, waterTemp };
  } catch {
    return { wave: null, waterTemp: null };
  }
}

// ===== 어종 적합도 =====

export function speciesFitFor(tempC: number, water?: "민물" | "바다" | null): SpeciesFit[] {
  const list = SPECIES_TEMP.filter((s) => (water ? s.water === water : true));
  const scored = list.map((s) => {
    let status: SpeciesFit["status"];
    if (tempC >= s.best[0] && tempC <= s.best[1]) status = "최적";
    else if (tempC >= s.min && tempC <= s.max) {
      const edge = Math.min(Math.abs(tempC - s.min), Math.abs(tempC - s.max));
      status = edge >= 3 ? "양호" : "보통";
    } else status = "비활성";
    return { name: s.name, water: s.water, status };
  });
  const rank: Record<SpeciesFit["status"], number> = { 최적: 0, 양호: 1, 보통: 2, 비활성: 3 };
  scored.sort((a, b) => rank[a.status] - rank[b.status]);
  return scored.filter((s) => s.status !== "비활성").slice(0, 6);
}

// ===== 통합 수집 =====

/**
 * 좌표 하나에 대한 해양·기상 스냅샷.
 * 키가 없거나 API 가 실패한 항목은 null 이며, 그 사유는 notes 에 남는다. 절대 throw 하지 않는다.
 */
export async function getMarineSnapshot(
  lat: number,
  lng: number,
  water?: "민물" | "바다" | null,
): Promise<MarineSnapshot> {
  const notes: string[] = [];
  let tideApiKey = "";
  let weatherApiKey = "";
  try {
    // 관리자 화면에 저장된 값이 우선이고, 없으면 .env(TIDE_API_KEY / WEATHER_API_KEY)로 폴백된다.
    const c = await getMarineCredentials();
    tideApiKey = c.tideApiKey;
    weatherApiKey = c.weatherApiKey;
  } catch (e: any) {
    console.log(`${DEBUG_PREFIX} 자격증명 조회 실패: ${e?.message || "error"}`);
    notes.push("공공 API 키를 불러오지 못했습니다.");
  }
  // 키 값 자체는 절대 찍지 않고, 해결 여부/출처만 남긴다.
  console.log(
    `${DEBUG_PREFIX} keys tide=${tideApiKey ? `ok(len ${tideApiKey.length}${tideApiKey === process.env.TIDE_API_KEY ? ", env" : ", db"})` : "none"}` +
      ` weather=${weatherApiKey ? `ok(len ${weatherApiKey.length}${weatherApiKey === process.env.WEATHER_API_KEY ? ", env" : ", db"})` : "none"}` +
      ` at ${lat.toFixed(4)},${lng.toFixed(4)}`,
  );

  const { station: nearestStation, distanceKm } = findNearestStation(lat, lng);
  const inland = distanceKm > MAX_STATION_KM;

  const [tideApi, observed, kma, openMeteoPressure, openMeteoMarine] = await Promise.all([
    tideApiKey && !inland ? fetchTide(tideApiKey, lat, lng).catch(() => null) : Promise.resolve(null),
    // 수온·기압·해상풍은 최신관측 API 한 번으로 모두 얻는다.
    tideApiKey && !inland ? fetchDtRecent(tideApiKey, lat, lng).catch(() => EMPTY_DT_RECENT) : Promise.resolve(EMPTY_DT_RECENT),
    weatherApiKey ? fetchKmaNowcast(weatherApiKey, lat, lng).catch(() => ({ wind: null, air: null, pressure: null })) : Promise.resolve({ wind: null, air: null, pressure: null }),
    // Open-Meteo 기압 — 키 불필요, KMA getUltraSrtNcst에 PS가 없어 별도 호출
    fetchOpenMeteoPressure(lat, lng).catch(() => null),
    // Open-Meteo Marine — 파고·파주기·파향·수온 (키 불필요)
    !inland ? fetchOpenMeteoMarine(lat, lng).catch(() => ({ wave: null, waterTemp: null })) : Promise.resolve({ wave: null, waterTemp: null }),
  ]);

  // KHOA API 실측 → 알고리즘 근사치 순으로 폴백
  const tide = tideApi ?? (!inland ? computeTideAlgorithm(nearestStation, distanceKm) : null);
  const { waterTemp: khoaWaterTemp, pressure: seaPressure, wind: seaWind } = observed;

  // 수온: KHOA 실측 → Open-Meteo Marine 순으로 폴백
  const waterTemp = khoaWaterTemp ?? openMeteoMarine.waterTemp;

  if (tideApiKey) {
    if (inland) notes.push("가장 가까운 조위관측소가 멀어 물때·수온을 제공하지 않습니다(내륙 지점).");
    else if (!tideApi) notes.push("조석예보 API 응답 없음 — 천문조석 알고리즘으로 대체합니다 (오차 ±1h).");
  } else if (!inland) {
    notes.push("KHOA API 키 미등록 — 물때는 천문조석 알고리즘, 수온은 Open-Meteo 위성값을 사용합니다.");
  }
  if (!weatherApiKey) notes.push("기상청 API 키가 등록되지 않아 날씨 정보를 건너뛰었습니다.");

  // 해상 관측 바람이 낚시에 더 유효하지만, 없으면 기상청 실황으로 대체한다.
  const wind = seaWind ?? kma.wind;
  // 기압: KHOA 해양 관측 → Open-Meteo 순으로 폴백
  const pressure = seaPressure ?? openMeteoPressure;
  // 파고: Open-Meteo Marine (항상 시도)
  const wave = openMeteoMarine.wave;

  console.log(
    `${DEBUG_PREFIX} snapshot inland=${inland} 조석=${tide ? `${tide.events.length}건(${tideApi ? "KHOA" : "알고리즘"})` : "없음"}` +
      ` 수온=${waterTemp ? `${waterTemp.tempC}℃(${waterTemp.stationName})` : "없음"}` +
      ` 파고=${wave ? `${wave.heightM}m` : "없음"} 바람=${wind ? (wind.source ?? "ok") : "없음"}` +
      ` 기압=${pressure ? `${pressure.hpa}hPa(${pressure.source})` : "없음"} 기온=${kma.air ? "ok" : "없음"}`,
  );

  return {
    lat,
    lng,
    inland,
    tide,
    waterTemp,
    wind,
    pressure,
    air: kma.air,
    wave,
    speciesFit: waterTemp ? speciesFitFor(waterTemp.tempC, water ?? null) : [],
    configured: { tide: Boolean(tideApiKey), weather: Boolean(weatherApiKey) },
    notes,
    fetchedAt: new Date().toISOString(),
  };
}

/** OpenAI 프롬프트에 넣기 좋은 축약 형태 (토큰 절약 + 환각 방지용 명시적 null) */
export function marineForPrompt(m: MarineSnapshot | null) {
  if (!m) return null;
  return {
    물때: m.tide?.mulddae ?? null,
    조석상태: m.tide?.phase ?? null,
    다음만조간조: m.tide?.next ? `${m.tide.next.kind === "high" ? "만조" : "간조"} ${m.tide.next.label}` : null,
    관측소: m.tide?.stationName ?? m.waterTemp?.stationName ?? null,
    수온C: m.waterTemp?.tempC ?? null,
    기온C: m.air?.tempC ?? null,
    풍향: m.wind?.label ?? null,
    풍속ms: m.wind?.speedMs ?? null,
    기압hPa: m.pressure?.hpa ?? null,
    기압변화: m.pressure ? m.pressure.trend : null,
    습도pct: m.air?.humidity ?? null,
    강수: m.air?.precipitation ?? null,
    시간당강수량mm: m.air?.rainMm ?? null,
    파고m: m.wave?.heightM ?? null,
    파주기초: m.wave?.periodS ?? null,
    파향: m.wave?.directionLabel ?? null,
    수온기준활성어종: m.speciesFit.filter((s) => s.status === "최적").map((s) => s.name),
  };
}
