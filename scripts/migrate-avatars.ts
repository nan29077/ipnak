/**
 * 아바타 base64 → 파일 저장 마이그레이션 스크립트
 *
 * DB 의 User.avatarUrl 에 base64 data URI 로 저장된 프로필 사진을
 * /public/uploads/avatars/ 에 파일로 저장하고 avatarUrl 을 제공 URL 로 교체한다.
 *
 * 실행:  npx tsx scripts/migrate-avatars.ts
 *  - 서버 코드(src)를 import 하지 않는 독립 실행형 스크립트다 (server-only 제약 회피).
 *  - 여러 번 실행해도 안전하다 (data URI 가 아닌 avatarUrl 은 건드리지 않는다).
 */
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const AVATAR_DIR = join(process.cwd(), "public", "uploads", "avatars");
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

async function saveDataUriToFile(dataUri: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  const ext = MIME_EXT[match[1].toLowerCase()];
  if (!ext) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) return null;
  const fileName = `${randomUUID()}${ext}`;
  await mkdir(AVATAR_DIR, { recursive: true });
  await writeFile(join(AVATAR_DIR, fileName), buffer);
  return `/api/uploads/avatars/${fileName}`;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { avatarUrl: { startsWith: "data:image/" } },
    select: { id: true, nickname: true, avatarUrl: true },
  });

  console.log(`base64 아바타를 가진 회원: ${users.length}명`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.avatarUrl) continue;
    try {
      const url = await saveDataUriToFile(user.avatarUrl);
      if (!url) {
        // 형식이 깨진 data URI — 원본을 그대로 두어 기존 표시가 깨지지 않게 한다
        console.warn(`  [건너뜀] ${user.nickname} (${user.id}) — data URI 형식 불량`);
        skipped++;
        continue;
      }
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
      console.log(`  [완료] ${user.nickname} (${user.id}) → ${url}`);
      migrated++;
    } catch (e) {
      console.error(`  [실패] ${user.nickname} (${user.id})`, e);
      skipped++;
    }
  }

  console.log(`\n마이그레이션 완료: 변환 ${migrated}명, 건너뜀 ${skipped}명`);
}

main()
  .catch((e) => {
    console.error("마이그레이션 오류:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
