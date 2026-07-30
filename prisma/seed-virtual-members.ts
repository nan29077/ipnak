/**
 * AI 가상회원 100명 생성 스크립트
 * Usage: npm run db:seed-virtual          (생성·갱신)
 *        npm run db:seed-virtual -- reset (가상회원 및 생성 콘텐츠 전체 삭제)
 *
 * 관리자 페이지 "가상회원 관리"의 생성/초기화 버튼과 동일한 로직(src/lib/virtualMemberSeed.ts)을 사용한다.
 * 여러 번 실행해도 안전하다(이미 있는 계정은 프로필만 갱신).
 */
import { prisma } from "@/lib/prisma";
import { resetVirtualMembers, seedVirtualMembers } from "@/lib/virtualMemberSeed";

async function main() {
  const mode = process.argv[2] === "reset" ? "reset" : "seed";

  if (mode === "reset") {
    const r = await resetVirtualMembers();
    console.log("가상회원 초기화 완료");
    console.log(`  삭제된 가상회원  : ${r.deletedMembers}명`);
    console.log(`  삭제된 게시글    : ${r.deletedPosts}건`);
    console.log(`  삭제된 댓글      : ${r.deletedComments}건`);
    console.log(`  삭제된 중고마켓글: ${r.deletedMarketListings}건`);
  } else {
    const s = await seedVirtualMembers();
    console.log("가상회원 생성 완료");
    console.log(`  신규 생성 : ${s.created}명`);
    console.log(`  프로필 갱신: ${s.updated}명`);
    console.log(`  전체      : ${s.total}명`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
