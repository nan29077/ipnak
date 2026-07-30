/**
 * AI 가상회원 테이블 초기화 스크립트
 * Usage: node scripts/init-virtual-tables.mjs
 *
 * dev.db 에는 schema.prisma 에 없는 레거시 컬럼(IpnakBallProduct.type 등)이 남아 있어
 * `prisma db push` 를 그대로 돌리면 실제로 사용 중인 컬럼이 삭제된다.
 * 그래서 가상회원용 테이블만 scripts/init-tables.mjs 와 같은 방식으로 직접 만든다.
 * DDL 은 Prisma 가 생성하는 것과 동일한 컬럼·인덱스·외래키 구성을 따른다.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("가상회원 테이블 확인 중...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VirtualMember" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "personality" TEXT NOT NULL,
      "regionGroup" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "activityCount" INTEGER NOT NULL DEFAULT 0,
      "lastActiveAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VirtualMember_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "VirtualMember_userId_key" ON "VirtualMember"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VirtualMember_personality_idx" ON "VirtualMember"("personality")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VirtualMember_regionGroup_idx" ON "VirtualMember"("regionGroup")`);
  console.log("VirtualMember 테이블 OK");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VirtualActivity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "memberId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT,
      "summary" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VirtualActivity_memberId_fkey" FOREIGN KEY ("memberId")
        REFERENCES "VirtualMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VirtualActivity_memberId_idx" ON "VirtualActivity"("memberId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VirtualActivity_kind_idx" ON "VirtualActivity"("kind")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VirtualActivity_createdAt_idx" ON "VirtualActivity"("createdAt")`);
  console.log("VirtualActivity 테이블 OK");

  console.log("완료!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
