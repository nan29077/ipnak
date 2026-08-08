/**
 * PhoneVerification 테이블 생성 스크립트
 * 실행: node setup-phone-verification.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`PhoneVerification\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`phone\` VARCHAR(191) NOT NULL,
        \`code\` VARCHAR(191) NOT NULL,
        \`verified\` BOOLEAN NOT NULL DEFAULT false,
        \`expiresAt\` DATETIME(3) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX \`PhoneVerification_phone_idx\` (\`phone\`),
        INDEX \`PhoneVerification_expiresAt_idx\` (\`expiresAt\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('✅ PhoneVerification 테이블 생성 완료');

    // prisma generate 안내
    console.log('\n이제 다음 명령을 실행하세요:');
    console.log('  npx prisma generate');
  } catch (e) {
    console.error('❌ 오류:', e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
