/** 해양 관측 수온·물때를 적용하면 안 되는 대표 민물 어종 */
const FRESHWATER_SPECIES = new Set([
  "배스", "붕어", "잉어", "가물치", "쏘가리", "꺽지", "강준치", "누치", "송어", "산천어", "메기", "블루길",
]);

/** 쉼표로 묶인 주요 어종 문자열도 민물 여부를 판별한다. */
export function isFreshwaterSpecies(value: string | null | undefined): boolean {
  if (!value) return false;
  return value
    .split(/[,/·]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .some((name) => FRESHWATER_SPECIES.has(name));
}

/** 민물 어종이면 해양 관측값을 버리고, 날씨·기온만 유지한다. */
export function filterMarineEnvironment<T extends {
  waterTemp: number | null;
  tideName: string | null;
  tidePhase: string | null;
}>(environment: T, species: string | null | undefined): T {
  if (!isFreshwaterSpecies(species)) return environment;
  return { ...environment, waterTemp: null, tideName: null, tidePhase: null };
}
