/**
 * 입낚키링 NFC 연동 테이블 자동 생성
 * IpnakKeyringRegistry + LinkedKeyring 이 없으면 자동으로 만든다.
 * Prisma migrate 없이 실서버에서도 즉시 사용 가능하도록 CREATE TABLE IF NOT EXISTS 사용.
 *
 * ⚠️ 완료된 Promise 를 공유한다 (ensureIpnakRawColumns 와 동일 패턴).
 *    플래그만 세우면 CREATE TABLE 이 끝나기 전에 두 번째 요청이 통과해
 *    "Table doesn't exist" 로 500 이 날 수 있다 (GET/POST 동시 호출 등).
 */
import "server-only";
import { prisma } from "./prisma";

let ensurePromise: Promise<void> | null = null;

export function ensureKeyringTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = run().catch(() => {
      // 실패 시 다음 요청에서 다시 시도할 수 있도록 캐시를 비운다.
      ensurePromise = null;
    });
  }
  return ensurePromise;
}

async function run(): Promise<void> {
  // IpnakKeyringRegistry
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`IpnakKeyringRegistry\` (
      \`id\`        VARCHAR(191) NOT NULL,
      \`keyringId\` VARCHAR(191) NOT NULL,
      \`memo\`      LONGTEXT,
      \`isActive\`  TINYINT(1)  NOT NULL DEFAULT 1,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`IpnakKeyringRegistry_keyringId_key\` (\`keyringId\`),
      KEY \`IpnakKeyringRegistry_isActive_idx\` (\`isActive\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});

  // LinkedKeyring — User 와 엔진·콜레이션이 달라 FK 생성이 실패하면
  // 테이블 자체가 안 만들어져 키링 기능이 전부 죽는다. FK 없이 한 번 더 시도한다.
  const linkedKeyringColumns = `
      \`id\`        VARCHAR(191) NOT NULL,
      \`userId\`    VARCHAR(191) NOT NULL,
      \`keyringId\` VARCHAR(191) NOT NULL,
      \`linkedAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`LinkedKeyring_userId_keyringId_key\` (\`userId\`, \`keyringId\`),
      KEY \`LinkedKeyring_userId_idx\` (\`userId\`),
      KEY \`LinkedKeyring_keyringId_idx\` (\`keyringId\`)`;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`LinkedKeyring\` (${linkedKeyringColumns},
        CONSTRAINT \`LinkedKeyring_userId_fkey\`
          FOREIGN KEY (\`userId\`) REFERENCES \`User\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`LinkedKeyring\` (${linkedKeyringColumns}
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
  }

  // CatchRecord.keyringId — 키링 모드로 측정한 기록에 키링 ID를 연결한다.
  // Prisma 스키마에 없는 raw 전용 컬럼 (ensureIpnakRawColumns 의 컬럼들과 동일한 방식,
  // 이미 존재하면 ALTER 가 실패하므로 오류는 무시).
  await prisma
    .$executeRawUnsafe(`ALTER TABLE \`CatchRecord\` ADD COLUMN \`keyringId\` VARCHAR(191) NULL`)
    .catch(() => {});
}
