// ===== 물고기 무게 자동 산출 =====
// 측정된 길이(cm)로 참고용 무게를 추정한다. 오차 범위는 약 ±15~20%.
import { estimateWeightKg } from "./fishData";

// W = a × L^b (어류 길이-무게 상관관계)
export const SPECIES_WEIGHT_PARAMS: Record<string, { a: number; b: number; name: string }> = {
  largemouth_bass: { a: 0.00000985, b: 3.16, name: "라지마우스 배스" },
  smallmouth_bass: { a: 0.00000853, b: 3.19, name: "스몰마우스 배스" },
  bluegill:        { a: 0.0000142,  b: 3.08, name: "블루길" },
  red_seabream:    { a: 0.0000121,  b: 3.05, name: "참돔" },
  flounder:        { a: 0.0000078,  b: 3.22, name: "광어" },
  rockfish:        { a: 0.0000095,  b: 3.10, name: "우럭" },
  mackerel:        { a: 0.0000063,  b: 3.18, name: "고등어" },
  carp:            { a: 0.0000175,  b: 3.02, name: "잉어" },
  crucian_carp:    { a: 0.0000168,  b: 3.04, name: "붕어" },
  trout:           { a: 0.0000082,  b: 3.14, name: "송어" },
  unknown:         { a: 0.0000100,  b: 3.10, name: "기타 어종" },
};

export function estimateWeight(lengthCm: number, speciesKey: string = "unknown"): number {
  const params = SPECIES_WEIGHT_PARAMS[speciesKey] ?? SPECIES_WEIGHT_PARAMS.unknown;
  return Math.round(params.a * Math.pow(lengthCm, params.b) * 1000); // 결과: g(그램)
}

// ===== 길이 + 너비(둘레) 기반 무게 산출 =====
// 물고기를 옆으로 눕혀 촬영하면 사진에서 전장(L)과 몸통 최대 너비(체고 W)를 같이 잴 수 있다.
// 몸통 단면을 타원으로 근사하면 둘레 G ≈ π × (체고 + 두께) / 2 = W × π × girthK
//   → girthK = (1 + 두께/체고) / 2. 납작한 어종일수록 작고(0.55), 통통한 어종일수록 크다(0.75).
// 무게는 낚시계 표준 필드 공식 W(lb) = L(in) × G(in)² / shapeFactor 를 미터법으로 환산해서 쓴다.
//   shapeFactor: 배스 800(표준) / 슬림한 어종일수록 큰 값.

/** 인치·파운드 공식 상수 → cm·g 공식 상수 변환 계수 (2.54³ / 453.592 ≈ 0.03613) */
const IMPERIAL_TO_METRIC = Math.pow(2.54, 3) / 453.592;

export type GirthParams = { girthK: number; shapeFactor: number; name: string };

/** 어종별 둘레 계수(girthK)와 체형 계수(shapeFactor) */
export const SPECIES_GIRTH_PARAMS: Record<string, GirthParams> = {
  largemouth_bass:  { girthK: 0.65, shapeFactor: 800,  name: "라지마우스 배스" },
  smallmouth_bass:  { girthK: 0.64, shapeFactor: 800,  name: "스몰마우스 배스" },
  bluegill:         { girthK: 0.58, shapeFactor: 900,  name: "블루길" },
  red_seabream:     { girthK: 0.60, shapeFactor: 900,  name: "참돔" },
  flounder:         { girthK: 0.55, shapeFactor: 1100, name: "광어" },
  rockfish:         { girthK: 0.68, shapeFactor: 850,  name: "우럭" },
  mackerel:         { girthK: 0.78, shapeFactor: 900,  name: "고등어" },
  carp:             { girthK: 0.70, shapeFactor: 800,  name: "잉어" },
  crucian_carp:     { girthK: 0.62, shapeFactor: 850,  name: "붕어" },
  trout:            { girthK: 0.70, shapeFactor: 900,  name: "송어" },
  // SPECIES_WEIGHT_PARAMS에는 없지만 앱 어종 칩에 있는 어종
  sea_bass:         { girthK: 0.68, shapeFactor: 950,  name: "농어" },
  black_seabream:   { girthK: 0.60, shapeFactor: 900,  name: "감성돔" },
  yellowtail:       { girthK: 0.76, shapeFactor: 900,  name: "방어" },
  hairtail:         { girthK: 0.60, shapeFactor: 1000, name: "갈치" },
  spanish_mackerel: { girthK: 0.74, shapeFactor: 1000, name: "삼치" },
  unknown:          { girthK: 0.65, shapeFactor: 900,  name: "기타 어종" },
};

/** 한글 어종명 → 둘레 계수 키 (SPECIES_WEIGHT_PARAMS에 없는 어종까지 포함) */
const NAME_TO_GIRTH_KEY: Record<string, string> = {
  "농어": "sea_bass",
  "감성돔": "black_seabream",
  "방어": "yellowtail",
  "갈치": "hairtail",
  "삼치": "spanish_mackerel",
};

/** 어종 키 또는 한글 어종명으로 둘레 계수를 찾는다. 대응 어종이 없으면 unknown */
export function girthParamsFor(species?: string | null): GirthParams {
  const n = (species ?? "").trim();
  if (!n) return SPECIES_GIRTH_PARAMS.unknown;
  if (SPECIES_GIRTH_PARAMS[n]) return SPECIES_GIRTH_PARAMS[n]; // 이미 키를 넘긴 경우
  const key = speciesKeyFromName(n) ?? NAME_TO_GIRTH_KEY[n];
  return (key && SPECIES_GIRTH_PARAMS[key]) || SPECIES_GIRTH_PARAMS.unknown;
}

/**
 * 길이(cm) + 몸통 최대 너비(cm) → 추정 무게(g)
 * 둘레(G) = 너비 × π × girthK, 무게 = L × G² / (shapeFactor × 0.03613)
 * 너비를 못 구했거나 값이 비상식적이면 null (호출부에서 a × L^b 로 폴백)
 */
export function estimateWeightByWidth(
  lengthCm: number,
  bodyWidthCm: number,
  species?: string | null,
): number | null {
  const L = Number(lengthCm);
  const W = Number(bodyWidthCm);
  if (!Number.isFinite(L) || !Number.isFinite(W) || L <= 0 || W <= 0) return null;
  // 너비가 전장의 5~70% 범위를 벗어나면 감지 오류로 보고 폴백
  const ratio = W / L;
  if (ratio < 0.05 || ratio > 0.7) return null;

  const p = girthParamsFor(species);
  const girthCm = W * Math.PI * p.girthK;
  const grams = (L * girthCm * girthCm) / (p.shapeFactor * IMPERIAL_TO_METRIC);
  return Number.isFinite(grams) && grams > 0 ? Math.round(grams) : null;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)}kg`;
  return `${grams}g`;
}

// ===== UI 보조 =====

/** 어종 선택 드롭다운용 목록 */
export const SPECIES_WEIGHT_OPTIONS = Object.entries(SPECIES_WEIGHT_PARAMS).map(([key, v]) => ({ key, name: v.name }));

/** 앱에서 쓰는 한글 어종명 → 무게 산출용 어종 키 */
const NAME_TO_KEY: Record<string, string> = {
  "배스": "largemouth_bass",
  "라지마우스 배스": "largemouth_bass",
  "스몰마우스 배스": "smallmouth_bass",
  "블루길": "bluegill",
  "참돔": "red_seabream",
  "광어": "flounder",
  "우럭": "rockfish",
  "우럭(조피볼락)": "rockfish",
  "조피볼락": "rockfish",
  "고등어": "mackerel",
  "잉어": "carp",
  "붕어": "crucian_carp",
  "송어": "trout",
};

/** 한글 어종명(또는 이미 어종 키)으로 무게 산출용 키를 찾는다. 대응 어종이 없으면 null */
export function speciesKeyFromName(name?: string | null): string | null {
  const n = (name ?? "").trim();
  if (!n) return null;
  if (SPECIES_WEIGHT_PARAMS[n]) return n; // 이미 키를 넘긴 경우
  return NAME_TO_KEY[n] ?? null;
}

/**
 * 기록에 표시할 최종 추정 무게(g).
 * 저장된 값 → 길이+너비 둘레 공식 → 무게 산출용 어종 키 → 기존 어종별 계수(fishData) 순으로 사용한다.
 * (SPECIES_WEIGHT_PARAMS에 없는 어종은 fishData 쪽 계수가 더 정확하므로 폴백)
 */
export function resolveWeightG(opts: {
  estimatedWeight?: number | null;
  species?: string | null; // 무게 산출용 어종 키
  speciesName?: string | null; // 표시용 한글 어종명
  lengthCm?: number | null;
  bodyWidthCm?: number | null; // AI가 감지한 몸통 최대 너비(cm)
}): number | null {
  if (opts.estimatedWeight != null && opts.estimatedWeight > 0) return opts.estimatedWeight;
  const L = Number(opts.lengthCm);
  if (!Number.isFinite(L) || L <= 0) return null;
  // 너비가 있으면 둘레 기반 공식이 더 정확 — 우선 사용
  if (opts.bodyWidthCm != null) {
    const byWidth = estimateWeightByWidth(L, Number(opts.bodyWidthCm), opts.species || opts.speciesName);
    if (byWidth != null) return byWidth;
  }
  const key = opts.species || speciesKeyFromName(opts.speciesName);
  if (key) {
    const g = estimateWeight(L, key);
    return Number.isFinite(g) && g > 0 ? g : null;
  }
  const kg = estimateWeightKg(opts.speciesName, L);
  return kg != null ? Math.round(kg * 1000) : null;
}
