import { PrismaClient } from "@prisma/client";

const MALE_CHARS = Array.from(
  { length: 13 },
  (_, i) =>
    `/%EC%BA%90%EB%A6%AD%ED%84%B0%20%EC%8A%A4%ED%8B%B0%EC%BB%A4%20%EC%9D%B4%EB%AF%B8%EC%A7%80/%EB%82%A8%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90/%EB%82%A8%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90${i + 1}.png`
);
const FEMALE_CHARS = Array.from(
  { length: 13 },
  (_, i) =>
    `/%EC%BA%90%EB%A6%AD%ED%84%B0%20%EC%8A%A4%ED%8B%B0%EC%BB%A4%20%EC%9D%B4%EB%AF%B8%EC%A7%80/%EC%97%AC%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90/%EC%97%AC%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90${i + 1}.png`
);
const ALL_CHARS = [...MALE_CHARS, ...FEMALE_CHARS];

function getCharacterAvatar(userId: string): string {
  const seed = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ALL_CHARS[seed % ALL_CHARS.length];
}

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, nickname: true, avatarUrl: true } });
  let updated = 0;
  for (const u of users) {
    if (!u.avatarUrl || u.avatarUrl.includes("pravatar.cc") || u.avatarUrl.includes("picsum")) {
      const newAvatar = getCharacterAvatar(u.id);
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: newAvatar } });
      console.log(`✓ ${u.nickname}: → 캐릭터 이미지 적용`);
      updated++;
    }
  }
  console.log(`\n완료: ${updated}명 업데이트`);
  await prisma.$disconnect();
}

main().catch(console.error);
