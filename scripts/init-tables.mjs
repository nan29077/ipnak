/**
 * DB 테이블 초기화 스크립트 (Windows에서 실행)
 * Usage: node scripts/init-tables.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("DB 테이블 확인 중...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IpnakBallProduct" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      imageUrl TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("IpnakBallProduct 테이블 OK");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IpnakBallOrder" (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      productId TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      totalPrice INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      addressName TEXT,
      address TEXT,
      addressDetail TEXT,
      phone TEXT,
      memo TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("IpnakBallOrder 테이블 OK");

  console.log("완료!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
