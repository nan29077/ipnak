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
 * 저장된 값 → 무게 산출용 어종 키 → 기존 어종별 계수(fishData) 순으로 사용한다.
 * (SPECIES_WEIGHT_PARAMS에 없는 어종은 fishData 쪽 계수가 더 정확하므로 폴백)
 */
export function resolveWeightG(opts: {
  estimatedWeight?: number | null;
  species?: string | null; // 무게 산출용 어종 키
  speciesName?: string | null; // 표시용 한글 어종명
  lengthCm?: number | null;
}): number | null {
  if (opts.estimatedWeight != null && opts.estimatedWeight > 0) return opts.estimatedWeight;
  const L = Number(opts.lengthCm);
  if (!Number.isFinite(L) || L <= 0) return null;
  const key = opts.species || speciesKeyFromName(opts.speciesName);
  if (key) {
    const g = estimateWeight(L, key);
    return Number.isFinite(g) && g > 0 ? g : null;
  }
  const kg = estimateWeightKg(opts.speciesName, L);
  return kg != null ? Math.round(kg * 1000) : null;
}
