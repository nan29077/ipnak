import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const where = {
    distanceM: 0,
    durationSec: 0,
    catchCount: 0,
  };

  const count = await prisma.fishingTrip.count({ where });
  console.log(`삭제 대상 FishingTrip: ${count}건`);

  if (count === 0) {
    console.log("삭제할 항목이 없습니다.");
    return;
  }

  const result = await prisma.fishingTrip.deleteMany({ where });
  console.log(`삭제 완료: ${result.count}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
