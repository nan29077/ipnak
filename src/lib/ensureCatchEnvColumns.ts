/**
 * 계측 기록의 환경 정보(날씨·기온·수온·물때) 컬럼 자동 생성
 *
 * 계측일지는 로컬(localStorage) 기록과 서버(/api/catch) 기록을 합쳐 보여준다.
 * 로컬 기록에는 날씨가 들어 있었지만 CatchRecord 에는 저장할 곳이 없어,
 * 기기를 바꾸거나 재설치해 서버 기록만 남은 경우 날씨·수온·물때가 전부 "-" 로 보였다.
 *
 * ensureKeyringTables 와 같은 방식으로 Prisma 스키마 밖의 raw 컬럼을 추가한다
 * (ALTER 는 이미 있으면 실패하므로 오류를 무시한다). Prisma migrate 없이
 * 실서버에서도 즉시 동작하며, 실패해도 기록 저장 자체는 그대로 진행된다.
 *
 * ⚠️ 완료된 Promise 를 공유한다 (ensureKeyringTables 와 동일 패턴).
 *    플래그만 세우면 ALTER 가 끝나기 전에 두 번째 요청이 통과해 "Unknown column" 이 날 수 있다.
 */
import "server-only";
import { prisma } from "./prisma";

/** 컬럼명 → MySQL 타입 (모두 NULL 허용 — 값이 없어도 기록은 저장된다) */
const COLUMNS: Record<string, string> = {
  weather: "VARCHAR(64) NULL", // 날씨 상태 (예: "맑음", "비")
  airTemp: "DOUBLE NULL", // 기온(°C)
  waterTemp: "DOUBLE NULL", // 수온(°C)
  tideName: "VARCHAR(32) NULL", // 물때 이름 (예: "7물")
  tidePhase: "VARCHAR(32) NULL", // 조석 위상 (예: "들물")
  windSpeed: "DOUBLE NULL", // 풍속(m/s)
};

/** 외부에서 읽고 쓸 컬럼 목록 (SELECT 문 구성에 사용) */
export const CATCH_ENV_COLUMNS = Object.keys(COLUMNS);

let ensurePromise: Promise<void> | null = null;

export function ensureCatchEnvColumns(): Promise<void> {
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
      .$executeRawUnsafe(`ALTER TABLE \`CatchRecord\` ADD COLUMN \`${name}\` ${type}`)
      .catch(() => {}); // 이미 존재하면 무시
  }
}
