/**
 * 신규 컬럼 추가 스크립트 (댓글 사진 / 피드 지역·어종)
 * Usage: node scripts/add-feed-columns.mjs
 *
 * dev.db 에는 schema.prisma 에 없는 레거시 컬럼이 남아 있어 `prisma db push` 를 돌리면
 * 실제 사용 중인 컬럼이 삭제된다. 그래서 신규 컬럼은 ALTER TABLE 로만 추가한다.
 * (추가 후에는 `npx prisma generate` 만 실행할 것)
 *
 * 이미 존재하는 컬럼이면 SQLite 가 "duplicate column name" 에러를 내므로 무시한다 → 재실행 안전.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** [테이블, 컬럼, 타입] */
const COLUMNS = [
  ["Comment", "imageUrl", "TEXT"], // 댓글 사진 첨부
  ["GroupComment", "imageUrl", "TEXT"], // 낚시단 댓글 사진 첨부
  ["Post", "location", "TEXT"], // 피드 지역 선택 ("전라남도 영암군")
  ["Post", "fishSpecies", "TEXT"], // 피드 어종 선택 ("바다 > 광어")
  ["MarketListing", "location", "TEXT"], // 중고마켓 상세 지역
  ["Post", "locationLabel", "TEXT"], // 워킹 피드 GPS 기반 수계명 캐시 ("영산강", "나주호")
];

async function main() {
  for (const [table, column, type] of COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
      console.log(`추가됨: ${table}.${column}`);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/duplicate column name/i.test(msg)) console.log(`이미 존재: ${table}.${column}`);
      else throw e;
    }
  }
  console.log("\n완료. 이제 `npx prisma generate` 를 실행하세요.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
