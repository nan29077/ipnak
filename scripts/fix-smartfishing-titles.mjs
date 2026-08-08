// 개발 DB의 "데이터피싱 기록" 제목을 "스마트피싱 기록"으로 일괄 수정
// 실행: node scripts/fix-smartfishing-titles.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const trips = await prisma.fishingTrip.updateMany({
    where: { title: { contains: "데이터피싱" } },
    data: { title: "스마트피싱 기록" },
  });
  console.log(`FishingTrip updated: ${trips.count} rows`);

  const points = await prisma.groupPoint.updateMany({
    where: { title: { contains: "데이터피싱" } },
    data: { title: "스마트피싱 기록" },
  });
  console.log(`GroupPoint updated: ${points.count} rows`);

  const posts = await prisma.post.updateMany({
    where: { title: { contains: "데이터피싱" } },
    data: { title: "스마트피싱 기록" },
  });
  console.log(`Post updated: ${posts.count} rows`);

  console.log("완료!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
