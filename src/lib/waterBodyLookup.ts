/**
 * GPS 좌표 → 가장 가까운 수계명(강·호수·저수지·바다·만·하천) 조회
 *
 * OpenStreetMap Overpass API 를 사용한다. 외부 API 이므로 실패해도 앱 동작에 영향이 없도록
 * 항상 null 로 폴백한다. 조회 결과는 Post.locationLabel 에 캐시되어 재조회하지 않는다.
 */

/**
 * Overpass 공개 인스턴스는 개별 서버가 자주 과부하(429)·타임아웃 상태가 된다.
 * 순서대로 시도해 처음으로 응답한 서버의 결과를 쓴다.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** OSM 사용 정책상 요청자를 식별할 수 있는 User-Agent 를 보낸다 */
const USER_AGENT = "ipnak-app/1.0 (walking-feed water body lookup)";
/** 요청 1건 타임아웃 — 서울 같은 조밀 지역은 응답에 10초 안팎 걸린다 */
const TIMEOUT_MS = 15_000;
/** 조회 1회(서버 폴백·반경 확대 포함) 전체 상한 — 넘으면 포기하고 null */
const TOTAL_BUDGET_MS = 35_000;

/** 반경(m) — 2km 에서 못 찾으면 5km 로 재시도 */
const SEARCH_RADII = [2000, 5000];

/**
 * 직전에 성공한 서버를 기억해 다음 조회에서 먼저 시도한다.
 * (백필 스크립트처럼 연속 호출할 때 죽은 서버에서 매번 타임아웃을 기다리지 않도록)
 */
let preferredEndpoint: string | null = null;

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** 이름에 이미 수계 유형이 포함되어 있는지 (강/천/호/저수지/댐/만/포/해수욕장 등) */
const WATER_SUFFIX_RE = /(강|천|호|호수|저수지|댐|보|만|포구|항|바다|해|해수욕장|늪|지|沼)$/;

function buildQuery(lat: number, lng: number, radius: number): string {
  const around = `around:${radius},${lat},${lng}`;
  return `[out:json][timeout:10];
(
  way["natural"="water"](${around});
  way["waterway"~"river|stream|canal"](${around});
  relation["natural"="water"](${around});
  node["natural"="water"](${around});
  way["natural"="bay"](${around});
  relation["natural"="bay"](${around});
  node["natural"="bay"](${around});
);
out tags center;`;
}

/** 두 좌표 사이 거리(m) — Haversine */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 요소의 대표 좌표 (way/relation 은 center, node 는 lat/lon) */
function elementCoord(el: OverpassElement): { lat: number; lng: number } | null {
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  return null;
}

/** 한국어 이름 우선 → name:ko 차선. 둘 다 없으면 null (이름 없는 수계는 건너뜀) */
function pickName(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  const hangul = /[가-힣]/;
  const name = tags.name?.trim();
  if (name && hangul.test(name)) return name;
  const nameKo = tags["name:ko"]?.trim();
  if (nameKo) return nameKo;
  // 한글 이름이 전혀 없으면 표시하지 않는다 (영문/한자 라벨은 사용자에게 어색함)
  return null;
}

/**
 * 수계 규모 등급 (낮을수록 우선) — 0: 강·호수·저수지·만, 1: 하천·수로, 2: 연못·기타
 *
 * Overpass 의 around 필터는 "도형이 반경 안"인 요소만 돌려주므로 결과는 모두 실제로 근처에 있다.
 * 반면 center 는 도형 전체의 중심이라 한강처럼 큰 수계는 중심이 10km 넘게 떨어져 나온다.
 * 그래서 중심 거리만으로 고르면 바로 옆 강 대신 공원 연못이 뽑힌다 → 규모 등급을 먼저 본다.
 */
function prominenceTier(tags: Record<string, string> | undefined): number {
  const waterway = tags?.waterway;
  const water = tags?.water;
  if (tags?.natural === "bay") return 0;
  if (waterway === "river") return 0;
  if (water === "river" || water === "lake" || water === "reservoir") return 0;
  if (waterway === "stream" || waterway === "canal") return 1;
  if (water === "basin" || water === "canal" || water === "stream_pool") return 1;
  if (water === "pond" || water === "ditch") return 2;
  return 1; // natural=water 만 있고 세부 종류 미상 → 중간
}

/** 이름에 수계 유형이 없으면 태그 기반으로 접미사를 붙인다 */
function normalizeLabel(name: string, tags: Record<string, string> | undefined): string {
  if (WATER_SUFFIX_RE.test(name)) return name;
  const waterway = tags?.waterway;
  if (waterway === "river") return `${name}강`;
  if (waterway === "stream" || waterway === "canal") return `${name}천`;
  const water = tags?.water;
  if (water === "river") return `${name}강`;
  if (water === "reservoir" || water === "pond") return `${name}저수지`;
  if (water === "lake") return `${name}호`;
  if (tags?.natural === "bay") return `${name}만`;
  return name;
}

/** 단일 서버 조회 — 실패(429·타임아웃 등)는 null, 정상 응답은 배열(빈 배열 포함) */
async function fetchFrom(endpoint: string, query: string, timeoutMs: number): Promise<OverpassElement[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null; // 429/5xx → 다음 서버로
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return Array.isArray(json.elements) ? json.elements : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 서버 목록을 순회하며 처음 성공한 응답을 반환. 전부 실패하거나 예산 초과면 null */
async function queryOverpass(
  lat: number,
  lng: number,
  radius: number,
  deadline: number
): Promise<OverpassElement[] | null> {
  const query = buildQuery(lat, lng, radius);
  const ordered = preferredEndpoint
    ? [preferredEndpoint, ...OVERPASS_ENDPOINTS.filter((e) => e !== preferredEndpoint)]
    : OVERPASS_ENDPOINTS;

  for (const endpoint of ordered) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    const elements = await fetchFrom(endpoint, query, Math.min(TIMEOUT_MS, remaining));
    if (elements) {
      preferredEndpoint = endpoint;
      return elements;
    }
    if (preferredEndpoint === endpoint) preferredEndpoint = null;
  }
  return null;
}

/**
 * 좌표에서 가장 가까운 수계의 한국어 이름을 반환한다.
 * 반경 2km → 5km 순으로 조회하며, 못 찾거나 실패하면 null.
 */
export async function getNearestWaterBody(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const radius of SEARCH_RADII) {
    const elements = await queryOverpass(lat, lng, radius, deadline);
    if (!elements) return null; // 모든 서버 실패 → 반경 확대 재시도 없이 포기
    let best: { label: string; tier: number; dist: number } | null = null;

    for (const el of elements) {
      const name = pickName(el.tags);
      if (!name) continue; // 이름 없는 수계는 건너뜀
      const coord = elementCoord(el);
      const tier = prominenceTier(el.tags);
      // 중심 거리는 반경까지만 반영한다 — 반경을 넘는 값은 "도형이 큰 수계"라는 뜻이지 멀다는 뜻이 아니다.
      const raw = coord ? distanceM(lat, lng, coord.lat, coord.lng) : radius;
      const dist = Math.min(raw, radius);
      // 규모 등급 우선 → 같은 등급이면 가까운 것
      if (!best || tier < best.tier || (tier === best.tier && dist < best.dist)) {
        best = { label: normalizeLabel(name, el.tags), tier, dist };
      }
    }

    if (best) return best.label;
  }
  return null;
}
