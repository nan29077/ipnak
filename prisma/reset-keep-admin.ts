/**
 * 데이터 초기화 스크립트 — 최고관리자와 최고관리자가 등록한 콘텐츠만 남긴다.
 * Usage: npm run db:reset-keep-admin
 *
 * 관리자 페이지 "가상회원 관리 > 전체 데이터 초기화" 버튼과 동일한 로직(src/lib/dataReset.ts)을 사용한다.
 * 되돌릴 수 없으므로 실행 전 prisma/dev.db 백업을 권장한다.
 */
import { prisma } from "@/lib/prisma";
import { resetToSuperAdminOnly } from "@/lib/dataReset";

async function main() {
  const admins = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  if (admins === 0) {
    console.error("최고관리자(SUPER_ADMIN) 계정이 없습니다. 초기화를 중단합니다.");
    process.exit(1);
  }

  console.log(`최고관리자 ${admins}개 계정을 보존하고 초기화를 시작합니다...`);
  const summary = await resetToSuperAdminOnly();

  console.log("초기화 완료");
  console.log(`  삭제된 회원      : ${summary.deletedUsers}명`);
  console.log(`  삭제된 게시글    : ${summary.deletedPosts}건`);
  console.log(`  삭제된 중고마켓글: ${summary.deletedMarketListings}건`);
  console.log(`  삭제된 낚시단    : ${summary.deletedGroups}개`);
  console.log(`  보존된 관리자    : ${summary.keptAdmins}개 계정`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
