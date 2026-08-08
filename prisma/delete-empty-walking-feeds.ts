/**
 * 일회성 스크립트: 버그로 생성된 빈 워킹 피드 글 삭제
 * 조건: postType = "WALKING_FEED" AND (routePoints.length < 2 OR distanceM === 0)
 * Usage: tsx prisma/delete-empty-walking-feeds.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  // 1. 전체 WALKING_FEED 조회
  const all = await prisma.post.findMany({
    where: { postType: "WALKING_FEED" },
    select: { id: true, body: true },
  });

  // 2. 조건 필터링
  const toDelete = all.filter((post) => {
    if (!post.body) return true;
    try {
      const data = JSON.parse(post.body);
      const routePoints: unknown[] = Array.isArray(data.routePoints) ? data.routePoints : [];
      const distanceM: number = typeof data.distanceM === "number" ? data.distanceM : 0;
      return routePoints.length < 2 || distanceM === 0;
    } catch {
      // JSON 파싱 실패 → 비정상 데이터로 삭제 대상
      return true;
    }
  });

  console.log(`전체 WALKING_FEED 글: ${all.length}건`);
  console.log(`삭제 대상 (빈 워킹 피드): ${toDelete.length}건`);

  if (toDelete.length === 0) {
    console.log("삭제할 대상이 없습니다.");
    return;
  }

  const ids = toDelete.map((p) => p.id);

  // 3. 삭제
  const result = await prisma.post.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`삭제 완료: ${result.count}건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
