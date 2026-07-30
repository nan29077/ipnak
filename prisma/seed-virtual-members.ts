/**
 * AI 가상회원 100명 생성 스크립트
 * Usage: npm run db:seed-virtual              (회원 100명 생성·갱신)
 *        npm run db:seed-virtual -- content   (초기 시드 콘텐츠 생성 — 최근 60일치 활동)
 *        npm run db:seed-virtual -- all       (회원 + 콘텐츠 한 번에)
 *        npm run db:seed-virtual -- reset     (가상회원 및 생성 콘텐츠 전체 삭제)
 *
 * 관리자 페이지 "가상회원 관리"의 생성/초기화 버튼과 동일한 로직을 사용한다.
 * 여러 번 실행해도 안전하다(계정은 프로필만 갱신, 콘텐츠는 이미 있는 회원을 건너뛴다).
 */
import { prisma } from "@/lib/prisma";
import { resetVirtualMembers, seedVirtualMembers } from "@/lib/virtualMemberSeed";
import { seedVirtualContent } from "@/lib/virtualSeedContent";

async function seedContent() {
  const c = await seedVirtualContent({ days: 60 });
  console.log("초기 시드 콘텐츠 생성 완료");
  console.log(`  대상 회원   : ${c.members}명 (건너뜀 ${c.skipped}명)`);
  console.log(`  조황 피드   : ${c.feed}건`);
  console.log(`  일상 피드   : ${c.general}건`);
  console.log(`  조행기      : ${c.log}건`);
  console.log(`  워킹 피드   : ${c.walking}건`);
  console.log(`  중고마켓    : ${c.market}건`);
  console.log(`  댓글        : ${c.comments}건`);
  console.log(`  좋아요      : ${c.likes}건`);
}

async function main() {
  const arg = process.argv[2];
  const mode = arg === "reset" || arg === "content" || arg === "all" ? arg : "seed";

  if (mode === "content") {
    await seedContent();
    await prisma.$disconnect();
    return;
  }

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
    if (mode === "all") {
      console.log("");
      await seedContent();
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
