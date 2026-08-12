/**
 * 어장포인트의 위치·환경 정보 컬럼 자동 생성
 *
 * 어장포인트 저장 모달이 위치·날씨·기온·수온·바람·물때를 "자동 입력 후 수정 가능"한
 * 폼 필드로 받게 되면서, 사용자가 고친 값을 남길 자리가 필요해졌다.
 * (lat/lng 는 지도 표시용 좌표라 그대로 두고, 사람이 읽는 위치 표기는 locationName 에 둔다)
 *
 * ensureCatchEnvColumns 와 같은 방식으로 Prisma 스키마 밖의 raw 컬럼을 추가한다.
 * ALTER 는 이미 있으면 실패하므로 오류를 무시하며, Prisma migrate 없이 즉시 동작한다.
 *
 * ⚠️ 완료된 Promise 를 공유한다 — 플래그만 세우면 ALTER 가 끝나기 전에 두 번째 요청이
 *    통과해 "Unknown column" 이 날 수 있다.
 */
import "server-only";
import { prisma } from "./prisma";

/** 컬럼명 → MySQL 타입 (모두 NULL 허용 — 값이 없어도 저장은 된다) */
const COLUMNS: Record<string, string> = {
  locationName: "VARCHAR(120) NULL", // 위치 표기 (지명 또는 좌표 문자열)
  weather: "VARCHAR(64) NULL", // 날씨 상태 (예: "맑음")
  airTemp: "DOUBLE NULL", // 기온(°C)
  waterTemp: "DOUBLE NULL", // 수온(°C)
  wind: "VARCHAR(64) NULL", // 바람 (예: "서북서 0.9m/s")
  tideName: "VARCHAR(32) NULL", // 물때 (예: "4물")
  tidePhase: "VARCHAR(32) NULL", // 조석 상태 (예: "밀물", "썰물")
};

/** 외부에서 읽고 쓸 컬럼 목록 */
export const SPOT_ENV_COLUMNS = Object.keys(COLUMNS);

/** 문자열 컬럼 / 숫자 컬럼 구분 (정규화에 사용) */
export const SPOT_ENV_NUMBER_COLUMNS = ["airTemp", "waterTemp"];

let ensurePromise: Promise<void> | null = null;

export function ensureFishingSpotEnvColumns(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = run().catch(() => {
      // 실패 시 다음 요청에서 다시 시도할 수 있도록 캐시를 비운다.
      ensurePromise = null;
    });
  }
  return ensurePromise;
}

async function run(): Promise<void> {
  for (const [name, type] of Object.entries(COLUMNS)) {
    await prisma
      .$executeRawUnsafe(`ALTER TABLE \`FishingSpot\` ADD COLUMN \`${name}\` ${type}`)
      .catch(() => {}); // 이미 존재하면 무시
  }
}

/**
 * 요청 본문에서 환경 필드만 뽑아 정규화한다.
 * `partial` 이면 본문에 실제로 들어 있는 키만 반환한다 (PATCH 부분 수정용).
 */
export function pickSpotEnv(
  b: Record<string, unknown>,
  { partial = false } = {},
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const key of SPOT_ENV_COLUMNS) {
    if (partial && !(key in b)) continue;
    const v = b[key];
    if (SPOT_ENV_NUMBER_COLUMNS.includes(key)) {
      if (v === null || v === undefined || v === "") { out[key] = null; continue; }
      const n = Number(v);
      out[key] = Number.isFinite(n) ? n : null;
    } else {
      const max = key === "locationName" ? 120 : key === "tideName" || key === "tidePhase" ? 32 : 64;
      out[key] = typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    }
  }
  return out;
}
