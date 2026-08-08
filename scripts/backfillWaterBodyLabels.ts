/**
 * 기존 워킹 피드의 locationLabel(수계명) 일괄 채우기
 *
 * Usage: npx tsx scripts/backfillWaterBodyLabels.ts
 *
 * - lat/lng 가 있고 locationLabel 이 아직 없는 WALKING_FEED 포스트를 전부 조회
 * - Overpass API 로 수계명 조회 → Post.locationLabel 저장
 * - rate limit 방지를 위해 요청 사이 500ms 대기
 * - 조회 실패/결과 없음이면 건너뛴다 (다음 실행 때 재시도됨)
 */
import { prisma } from "@/lib/prisma";
import { getNearestWaterBody } from "@/lib/waterBodyLookup";

const DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const posts = await prisma.post.findMany({
    where: {
      postType: "WALKING_FEED",
      locationLabel: null,
      lat: { not: null },
      lng: { not: null },
    },
    select: { id: true, lat: true, lng: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`대상 워킹 피드: ${posts.length}건`);
  let filled = 0;
  let skipped = 0;

  for (const [i, p] of posts.entries()) {
    if (p.lat == null || p.lng == null) { skipped++; continue; }
    const label = await getNearestWaterBody(p.lat, p.lng);
    if (label) {
      await prisma.post.update({ where: { id: p.id }, data: { locationLabel: label } });
      filled++;
      console.log(`[${i + 1}/${posts.length}] ${p.id} → ${label}`);
    } else {
      skipped++;
      console.log(`[${i + 1}/${posts.length}] ${p.id} → 수계 없음(건너뜀)`);
    }
    if (i < posts.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n완료 — 저장 ${filled}건 / 건너뜀 ${skipped}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
