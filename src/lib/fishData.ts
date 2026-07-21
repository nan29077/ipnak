// ===== 스마트 자(Smart Ruler) 고도화 데이터 =====
// 1) 기준물체(Reference Object) 규격  2) 어종별 평균 길이  3) 길이-무게 추정식

// --- 기준물체: 실제 국제/한국 규격 기반 ---
export type ReferenceObject = {
  key: string;
  label: string;
  lengthCm: number; // 0 = 직접입력
  hint: string;
};

export const REFERENCE_OBJECTS: ReferenceObject[] = [
  { key: "CREDIT_CARD", label: "신용카드", lengthCm: 8.56, hint: "가로(장변) 85.6mm — ISO 규격" },
  { key: "COIN_500", label: "500원 동전", lengthCm: 2.65, hint: "지름 26.5mm" },
  { key: "A4_PAPER", label: "A4 용지", lengthCm: 29.7, hint: "세로(장변) 297mm" },
  { key: "RULER_30", label: "계측자 30cm", lengthCm: 30, hint: "계측판/자 30cm 구간" },
  { key: "CUSTOM", label: "직접입력", lengthCm: 0, hint: "알고 있는 길이를 cm로 입력" },
];

export function referenceByKey(key?: string | null): ReferenceObject | undefined {
  return REFERENCE_OBJECTS.find((r) => r.key === key);
}

// --- 어종별 평균 길이(cm): 국내 낚시 대상어의 일반적인 성체 기준 근사치 ---
export const SPECIES_AVG_CM: Record<string, number> = {
  // 민물
  배스: 35, 쏘가리: 35, 꺽지: 18, 강준치: 45, 가물치: 55, 붕어: 25, 잉어: 50,
  향어: 55, 메기: 45, 동자개: 20, 송어: 40, 산천어: 25, 은어: 20, 블루길: 15,
  빙어: 12, 장어: 60, 끄리: 30, 누치: 40,
  // 바다
  감성돔: 35, 돌돔: 35, 참돔: 45, 벵에돔: 30, 농어: 55, 광어: 45, 우럭: 30,
  볼락: 22, 열기: 25, 갈치: 80, 삼치: 60, 방어: 70, 부시리: 70, 고등어: 30,
  전갱이: 25, 학꽁치: 25, 숭어: 45, 도다리: 25, 노래미: 25, 망둥어: 15,
  무늬오징어: 25, 갑오징어: 20, 주꾸미: 12, 문어: 40, 낙지: 30, 참치: 100, 민어: 60,
};

export function speciesAvgCm(species?: string | null): number | null {
  if (!species) return null;
  return SPECIES_AVG_CM[species] ?? null;
}

// --- 길이-무게 추정: W(g) = a × L(cm)^b (어류학 표준 Length-Weight Relationship) ---
// 체형군별 계수 근사 (a: 조건계수, b: 성장지수 ≈ 3)
type LW = { a: number; b: number };

const LW_DEFAULT: LW = { a: 0.011, b: 3.0 }; // 일반 방추형

const SPECIES_LW: Record<string, LW> = {
  // 체고가 높은 돔류/붕어류 — 무거운 편
  감성돔: { a: 0.021, b: 3.0 }, 돌돔: { a: 0.022, b: 3.0 }, 참돔: { a: 0.02, b: 3.0 },
  벵에돔: { a: 0.021, b: 3.0 }, 붕어: { a: 0.019, b: 3.0 }, 향어: { a: 0.02, b: 3.0 },
  잉어: { a: 0.017, b: 3.0 }, 블루길: { a: 0.019, b: 3.0 },
  // 방추형
  배스: { a: 0.013, b: 3.0 }, 쏘가리: { a: 0.012, b: 3.0 }, 농어: { a: 0.01, b: 3.0 },
  우럭: { a: 0.015, b: 3.0 }, 볼락: { a: 0.014, b: 3.0 }, 열기: { a: 0.014, b: 3.0 },
  방어: { a: 0.014, b: 3.0 }, 부시리: { a: 0.013, b: 3.0 }, 삼치: { a: 0.007, b: 3.0 },
  고등어: { a: 0.009, b: 3.0 }, 전갱이: { a: 0.009, b: 3.0 }, 숭어: { a: 0.01, b: 3.0 },
  송어: { a: 0.011, b: 3.0 }, 참치: { a: 0.016, b: 3.0 }, 민어: { a: 0.01, b: 3.0 },
  // 편평형(광어/도다리)
  광어: { a: 0.009, b: 3.0 }, 도다리: { a: 0.011, b: 3.0 },
  // 세장형(길고 가는 체형) — 가벼운 편
  갈치: { a: 0.0009, b: 3.2 }, 장어: { a: 0.0016, b: 3.1 }, 학꽁치: { a: 0.003, b: 3.0 },
  빙어: { a: 0.005, b: 3.0 }, 은어: { a: 0.007, b: 3.0 },
  // 두족류(외투장 기준 근사)
  무늬오징어: { a: 0.05, b: 2.7 }, 갑오징어: { a: 0.06, b: 2.7 }, 주꾸미: { a: 0.06, b: 2.7 },
  문어: { a: 0.03, b: 2.8 }, 낙지: { a: 0.02, b: 2.8 },
};

/** 어종+길이(cm)로 추정 무게(kg) 계산. 데이터 없으면 일반 계수 사용 */
export function estimateWeightKg(species: string | null | undefined, lengthCm: number | null | undefined): number | null {
  const L = Number(lengthCm);
  if (!Number.isFinite(L) || L <= 0) return null;
  const { a, b } = (species && SPECIES_LW[species]) || LW_DEFAULT;
  const grams = a * Math.pow(L, b);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return Math.round(grams) / 1000;
}

/** kg 값을 사람이 읽기 좋은 문자열로 (0.85 → "850g", 3.24 → "3.24kg") */
export function formatWeight(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return "-";
  if (kg < 1) return `${Math.round(kg * 1000)}g`;
  return `${(Math.round(kg * 100) / 100).toFixed(2)}kg`;
}

/** 평균 대비 비율(%) — 100보다 크면 평균 이상 */
export function vsAveragePct(species: string | null | undefined, lengthCm: number | null | undefined): number | null {
  const avg = speciesAvgCm(species);
  const L = Number(lengthCm);
  if (!avg || !Number.isFinite(L) || L <= 0) return null;
  return Math.round((L / avg) * 100);
}
