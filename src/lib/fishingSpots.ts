// 지역별 실제 낚시터 데이터 — 가상회원 콘텐츠 생성에 사용한다.
//
// 좌표는 "포인트 수준(약 1~2km 오차 내)"의 대표 좌표다. 상당수는 이미 앱에서 쓰고 있는
// src/lib/regions.ts 의 OVERRIDES(명소 포인트) 좌표를 그대로 가져왔고, 나머지는 같은 파일의
// 시군구 대표 좌표를 기준으로 잡았다. 실측/측량 좌표가 아니므로 내비게이션 용도로 쓰면 안 된다.
//
// region 값은 앱의 광역 지역 표기(MARKET_REGIONS + 세종)를 따르며 가상회원의 User.region 과 일치한다.

export type SpotWater = "SEA" | "FRESH";

// 낚시 방식 — 조행기 게시판 카테고리(LOG_CATEGORIES) 매핑에 사용
export type SpotStyle = "BREAKWATER" | "ROCK" | "BEACH" | "BOAT" | "RESERVOIR" | "LAKE" | "RIVER" | "STREAM";

export type FishingSpot = {
  name: string;
  region: string; // 가상회원 User.region 과 동일한 광역 표기
  lat: number;
  lng: number;
  water: SpotWater;
  style: SpotStyle;
  species: string[]; // 해당 포인트에서 실제로 노리는 어종
};

export const FISHING_SPOTS: FishingSpot[] = [
  // ===== 서울 (한강 수계) =====
  { name: "뚝섬 한강공원", region: "서울", lat: 37.53, lng: 127.07, water: "FRESH", style: "RIVER", species: ["배스", "강준치", "누치", "붕어"] },
  { name: "잠실 한강 지구", region: "서울", lat: 37.52, lng: 127.09, water: "FRESH", style: "RIVER", species: ["배스", "강준치", "끄리"] },
  { name: "성수대교 하류", region: "서울", lat: 37.543, lng: 127.035, water: "FRESH", style: "RIVER", species: ["배스", "누치", "잉어"] },
  { name: "난지 한강공원", region: "서울", lat: 37.567, lng: 126.876, water: "FRESH", style: "RIVER", species: ["배스", "강준치", "붕어"] },
  { name: "여의도 샛강", region: "서울", lat: 37.525, lng: 126.933, water: "FRESH", style: "RIVER", species: ["붕어", "잉어", "블루길"] },

  // ===== 경기 =====
  { name: "팔당호", region: "경기", lat: 37.55, lng: 127.25, water: "FRESH", style: "LAKE", species: ["배스", "쏘가리", "붕어", "강준치"] },
  { name: "청평호", region: "경기", lat: 37.74, lng: 127.42, water: "FRESH", style: "LAKE", species: ["배스", "쏘가리", "꺽지"] },
  { name: "남한강 양평 구간", region: "경기", lat: 37.49, lng: 127.49, water: "FRESH", style: "RIVER", species: ["쏘가리", "배스", "누치"] },
  { name: "시화방조제", region: "경기", lat: 37.29, lng: 126.61, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "농어", "숭어"] },
  { name: "화성 궁평항", region: "경기", lat: 37.113, lng: 126.733, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "도다리"] },
  { name: "안성 금광저수지", region: "경기", lat: 36.98, lng: 127.32, water: "FRESH", style: "RESERVOIR", species: ["배스", "붕어", "가물치"] },

  // ===== 인천 =====
  { name: "영종도 삼목선착장", region: "인천", lat: 37.489, lng: 126.42, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "노래미"] },
  { name: "소무의도 갯바위", region: "인천", lat: 37.372, lng: 126.413, water: "SEA", style: "ROCK", species: ["우럭", "농어", "광어"] },
  { name: "강화 동검도", region: "인천", lat: 37.61, lng: 126.53, water: "SEA", style: "BREAKWATER", species: ["우럭", "숭어", "광어"] },
  { name: "인천 북항 방파제", region: "인천", lat: 37.4738, lng: 126.6216, water: "SEA", style: "BREAKWATER", species: ["숭어", "우럭", "노래미"] },
  { name: "자월도 갯바위", region: "인천", lat: 37.253, lng: 126.316, water: "SEA", style: "ROCK", species: ["우럭", "농어", "광어"] },

  // ===== 강원 =====
  { name: "속초항 방파제", region: "강원", lat: 38.21, lng: 128.6, water: "SEA", style: "BREAKWATER", species: ["학꽁치", "볼락", "열기", "삼치"] },
  { name: "경포해변", region: "강원", lat: 37.8, lng: 128.9, water: "SEA", style: "BEACH", species: ["도다리", "농어", "숭어"] },
  { name: "양양 남대천 하구", region: "강원", lat: 38.07, lng: 128.63, water: "FRESH", style: "RIVER", species: ["황어", "숭어", "누치"] },
  { name: "소양호", region: "강원", lat: 37.95, lng: 127.82, water: "FRESH", style: "LAKE", species: ["쏘가리", "배스", "붕어", "꺽지"] },
  { name: "인제 내린천", region: "강원", lat: 38.07, lng: 128.17, water: "FRESH", style: "STREAM", species: ["산천어", "송어", "꺽지"] },
  { name: "삼척 장호항", region: "강원", lat: 37.36, lng: 129.22, water: "SEA", style: "ROCK", species: ["볼락", "열기", "우럭"] },
  { name: "고성 아야진항", region: "강원", lat: 38.29, lng: 128.556, water: "SEA", style: "BREAKWATER", species: ["볼락", "학꽁치", "노래미"] },
  { name: "평창 오대천", region: "강원", lat: 37.3705, lng: 128.3902, water: "FRESH", style: "STREAM", species: ["산천어", "송어", "은어"] },

  // ===== 충북 =====
  { name: "충주호", region: "충북", lat: 36.997, lng: 128.06, water: "FRESH", style: "LAKE", species: ["쏘가리", "배스", "붕어", "메기"] },
  { name: "대청호 문의 수역", region: "충북", lat: 36.48, lng: 127.49, water: "FRESH", style: "LAKE", species: ["배스", "붕어", "잉어"] },
  { name: "단양 남한강", region: "충북", lat: 36.9846, lng: 128.3656, water: "FRESH", style: "RIVER", species: ["쏘가리", "꺽지", "누치"] },
  { name: "괴산호", region: "충북", lat: 36.8153, lng: 127.7866, water: "FRESH", style: "LAKE", species: ["배스", "붕어", "가물치"] },

  // ===== 대전/충남 =====
  { name: "예당저수지", region: "대전/충남", lat: 36.62, lng: 126.78, water: "FRESH", style: "RESERVOIR", species: ["붕어", "배스", "잉어", "가물치"] },
  { name: "대청호 대전 수역", region: "대전/충남", lat: 36.48, lng: 127.49, water: "FRESH", style: "LAKE", species: ["배스", "붕어", "잉어"] },
  { name: "태안 안흥방파제", region: "대전/충남", lat: 36.67, lng: 126.13, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "노래미"] },
  { name: "보령 대천방파제", region: "대전/충남", lat: 36.31, lng: 126.5, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "삼치", "고등어"] },
  { name: "서산 간월호", region: "대전/충남", lat: 36.69, lng: 126.39, water: "FRESH", style: "RESERVOIR", species: ["배스", "붕어", "가물치"] },
  { name: "홍성 남당항", region: "대전/충남", lat: 36.58, lng: 126.47, water: "SEA", style: "BREAKWATER", species: ["우럭", "도다리", "주꾸미"] },

  // ===== 전북 =====
  { name: "부안 격포방파제", region: "전북", lat: 35.62, lng: 126.46, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "농어", "삼치"] },
  { name: "군산 비응항", region: "전북", lat: 35.94, lng: 126.52, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "주꾸미"] },
  { name: "변산해수욕장", region: "전북", lat: 35.66, lng: 126.5, water: "SEA", style: "BEACH", species: ["도다리", "숭어", "농어"] },
  { name: "임실 옥정호", region: "전북", lat: 35.6177, lng: 127.2889, water: "FRESH", style: "LAKE", species: ["붕어", "배스", "잉어"] },
  { name: "고창 구시포항", region: "전북", lat: 35.4358, lng: 126.702, water: "SEA", style: "BREAKWATER", species: ["우럭", "광어", "도다리"] },

  // ===== 광주/전남 =====
  { name: "여수 신항 방파제", region: "광주/전남", lat: 34.74, lng: 127.74, water: "SEA", style: "BREAKWATER", species: ["볼락", "감성돔", "농어", "고등어"] },
  { name: "돌산 갯바위", region: "광주/전남", lat: 34.66, lng: 127.78, water: "SEA", style: "ROCK", species: ["감성돔", "벵에돔", "볼락"] },
  { name: "완도 청산도", region: "광주/전남", lat: 34.3111, lng: 126.755, water: "SEA", style: "ROCK", species: ["돌돔", "감성돔", "벵에돔"] },
  { name: "진도 팽목항", region: "광주/전남", lat: 34.33, lng: 126.16, water: "SEA", style: "BREAKWATER", species: ["감성돔", "농어", "우럭"] },
  { name: "목포 삼학도", region: "광주/전남", lat: 34.79, lng: 126.39, water: "SEA", style: "BREAKWATER", species: ["숭어", "농어", "우럭"] },
  { name: "담양호", region: "광주/전남", lat: 35.3211, lng: 126.988, water: "FRESH", style: "LAKE", species: ["배스", "붕어", "잉어"] },
  { name: "순천만 하구", region: "광주/전남", lat: 34.9506, lng: 127.4872, water: "SEA", style: "BEACH", species: ["숭어", "농어", "문어"] },

  // ===== 대구/경북 =====
  { name: "안동호", region: "대구/경북", lat: 36.566, lng: 128.78, water: "FRESH", style: "LAKE", species: ["배스", "쏘가리", "붕어", "잉어"] },
  { name: "임하호", region: "대구/경북", lat: 36.541, lng: 128.86, water: "FRESH", style: "LAKE", species: ["배스", "쏘가리", "붕어"] },
  { name: "구룡포 방파제", region: "대구/경북", lat: 35.99, lng: 129.55, water: "SEA", style: "BREAKWATER", species: ["볼락", "열기", "삼치", "고등어"] },
  { name: "호미곶 갯바위", region: "대구/경북", lat: 36.08, lng: 129.57, water: "SEA", style: "ROCK", species: ["벵에돔", "감성돔", "볼락"] },
  { name: "영덕 강구항", region: "대구/경북", lat: 36.415, lng: 129.3656, water: "SEA", style: "BREAKWATER", species: ["열기", "볼락", "우럭"] },
  { name: "울진 후정해변", region: "대구/경북", lat: 36.993, lng: 129.4, water: "SEA", style: "BEACH", species: ["도다리", "농어", "숭어"] },
  { name: "경주 감포항", region: "대구/경북", lat: 35.81, lng: 129.51, water: "SEA", style: "BREAKWATER", species: ["볼락", "학꽁치", "우럭"] },
  { name: "낙동강 강정 구간", region: "대구/경북", lat: 35.84, lng: 128.46, water: "FRESH", style: "RIVER", species: ["배스", "강준치", "붕어"] },

  // ===== 부산/울산/경남 =====
  { name: "기장 대변항 방파제", region: "부산/울산/경남", lat: 35.24, lng: 129.22, water: "SEA", style: "BREAKWATER", species: ["볼락", "학꽁치", "고등어", "전갱이"] },
  { name: "다대포 방파제", region: "부산/울산/경남", lat: 35.05, lng: 128.97, water: "SEA", style: "BREAKWATER", species: ["농어", "우럭", "숭어"] },
  { name: "통영항 방파제", region: "부산/울산/경남", lat: 34.84, lng: 128.42, water: "SEA", style: "BREAKWATER", species: ["볼락", "감성돔", "전갱이"] },
  { name: "통영 욕지도", region: "부산/울산/경남", lat: 34.625, lng: 128.27, water: "SEA", style: "BOAT", species: ["참돔", "감성돔", "볼락", "방어"] },
  { name: "거제 지세포방파제", region: "부산/울산/경남", lat: 34.85, lng: 128.71, water: "SEA", style: "BREAKWATER", species: ["볼락", "감성돔", "고등어"] },
  { name: "남해 미조항", region: "부산/울산/경남", lat: 34.705, lng: 127.92, water: "SEA", style: "BREAKWATER", species: ["감성돔", "볼락", "농어"] },
  { name: "창원 주남저수지", region: "부산/울산/경남", lat: 35.31, lng: 128.68, water: "FRESH", style: "RESERVOIR", species: ["배스", "붕어", "가물치"] },
  { name: "밀양강", region: "부산/울산/경남", lat: 35.5037, lng: 128.7466, water: "FRESH", style: "RIVER", species: ["배스", "붕어", "누치"] },
  { name: "울산 방어진항", region: "부산/울산/경남", lat: 35.5048, lng: 129.4167, water: "SEA", style: "BREAKWATER", species: ["볼락", "우럭", "고등어"] },

  // ===== 제주 =====
  { name: "이호테우 방파제", region: "제주", lat: 33.5, lng: 126.45, water: "SEA", style: "BREAKWATER", species: ["벵에돔", "무늬오징어", "한치"] },
  { name: "서귀포항 방파제", region: "제주", lat: 33.24, lng: 126.56, water: "SEA", style: "BREAKWATER", species: ["벵에돔", "무늬오징어", "참돔"] },
  { name: "사계 갯바위", region: "제주", lat: 33.22, lng: 126.31, water: "SEA", style: "ROCK", species: ["벵에돔", "돌돔", "감성돔"] },
  { name: "용담 갯바위", region: "제주", lat: 33.51, lng: 126.5, water: "SEA", style: "ROCK", species: ["벵에돔", "무늬오징어", "따치"] },
  { name: "성산 오조리 갯바위", region: "제주", lat: 33.46, lng: 126.92, water: "SEA", style: "ROCK", species: ["벵에돔", "무늬오징어", "돌돔"] },
  { name: "모슬포항", region: "제주", lat: 33.22, lng: 126.25, water: "SEA", style: "BOAT", species: ["방어", "부시리", "참돔"] },

  // ===== 세종 =====
  { name: "세종 금강보행교 구간", region: "세종", lat: 36.48, lng: 127.289, water: "FRESH", style: "RIVER", species: ["배스", "붕어", "강준치"] },
  { name: "합강공원 금강", region: "세종", lat: 36.52, lng: 127.31, water: "FRESH", style: "RIVER", species: ["배스", "누치", "잉어"] },
  { name: "대청호 세종 방면", region: "세종", lat: 36.48, lng: 127.49, water: "FRESH", style: "LAKE", species: ["배스", "붕어", "잉어"] },
];

/** 해당 지역의 낚시터 목록 (없으면 전체에서 폴백) */
export function spotsForRegion(region: string | null | undefined): FishingSpot[] {
  const list = FISHING_SPOTS.filter((s) => s.region === region);
  return list.length > 0 ? list : FISHING_SPOTS;
}

// 조행기 게시판 카테고리 매핑 (LOG_CATEGORIES 의 key)
export function logCategoryForSpot(style: SpotStyle): string {
  if (style === "BOAT") return "BOATING";
  if (style === "RESERVOIR") return "JWADAE";
  if (style === "BREAKWATER" || style === "ROCK" || style === "BEACH") return "SEA";
  return "FRESHWATER";
}

export const SPOT_STYLE_LABEL: Record<SpotStyle, string> = {
  BREAKWATER: "방파제",
  ROCK: "갯바위",
  BEACH: "해변",
  BOAT: "선상",
  RESERVOIR: "저수지",
  LAKE: "호수",
  RIVER: "강계",
  STREAM: "계류",
};

// ===== 워킹 동선 생성 =====

export type LatLng = { lat: number; lng: number };

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** 결정적 의사난수 (regions.ts 의 seeded 와 같은 방식) */
function seeded(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/**
 * 낚시터를 출발점으로 총 distanceM 만큼 걸은 것처럼 보이는 동선을 만든다.
 * 방파제·갯바위·강계 모두 "한 방향으로 이동하며 완만하게 휘는" 형태가 자연스럽기 때문에,
 * 기준 방위에 구간마다 작은 각도 변화를 주며 좌표를 누적한다.
 * 같은 seed 면 항상 같은 동선이 나온다.
 */
export function buildWalkingRoute(spot: FishingSpot, distanceM: number, seed: number): LatLng[] {
  const steps = Math.max(12, Math.min(40, Math.round(distanceM / 150)));
  const stepM = distanceM / steps;
  // 바다 포인트는 해안선을 따라 남북/동서로, 강계는 물길을 따라 이동하는 느낌을 주려고 기준 방위를 분산한다.
  let bearing = seeded(seed * 1.7) * Math.PI * 2;

  const points: LatLng[] = [{ lat: spot.lat, lng: spot.lng }];
  let { lat, lng } = spot;

  for (let i = 0; i < steps; i++) {
    // 구간마다 ±25° 이내로 방향을 틀어 자연스러운 곡선을 만든다.
    bearing += (seeded(seed * 3.1 + i * 7.3) - 0.5) * (Math.PI / 3.6);
    lat += (Math.cos(bearing) * stepM) / M_PER_DEG_LAT;
    lng += (Math.sin(bearing) * stepM) / mPerDegLng(lat);
    points.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }
  return points;
}

/**
 * 동선 위에서 어획 지점을 고른다.
 * 지도에 핀이 겹쳐 보이지 않도록 서로 떨어진 구간에서 뽑고, 몇 m 수준의 미세 오프셋을 준다.
 * (MiniRouteMapCanvas 는 소수점 4자리(~11m) 기준으로 클러스터링해 숫자 뱃지를 붙인다.)
 */
export function pickCatchMarkers(route: LatLng[], catchCount: number, seed: number): LatLng[] {
  if (catchCount <= 0 || route.length === 0) return [];
  const out: LatLng[] = [];
  const usable = Math.max(1, route.length - 2);

  for (let i = 0; i < catchCount; i++) {
    // 동선 전체에 고르게 분산 + 약간의 흔들림
    const ratio = (i + 0.5) / catchCount;
    const jitter = (seeded(seed * 5.9 + i * 11.7) - 0.5) * (1 / (catchCount * 2));
    const idx = Math.min(usable, Math.max(1, Math.round((ratio + jitter) * usable)));
    const base = route[idx];
    // 같은 자리에서 여러 마리 나온 것처럼 보이도록 20% 확률로 직전 지점 근처에 붙인다.
    const stack = i > 0 && seeded(seed * 8.3 + i) < 0.2;
    const anchor = stack ? out[out.length - 1] : base;
    out.push({
      lat: Number((anchor.lat + (seeded(seed * 13.1 + i * 3.7) - 0.5) * 0.00025).toFixed(6)),
      lng: Number((anchor.lng + (seeded(seed * 17.3 + i * 5.1) - 0.5) * 0.00025).toFixed(6)),
    });
  }
  return out;
}
