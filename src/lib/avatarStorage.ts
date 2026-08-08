// 아바타 이미지 파일 저장 유틸
// base64 data URI 로 넘어온 프로필 사진을 /public/uploads/avatars/ 에 파일로 저장하고
// 제공 URL(/api/uploads/avatars/<파일명>)을 돌려준다.
// (DB 에 수백 KB 짜리 base64 문자열이 쌓이는 것을 방지)

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const AVATAR_DIR = join(process.cwd(), "public", "uploads", "avatars");
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB (클라이언트에서 200px 로 압축되므로 실제로는 훨씬 작다)

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** 문자열이 이미지 data URI 인지 */
export function isImageDataUri(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

/**
 * base64 이미지 data URI 를 파일로 저장하고 제공 URL 을 반환한다.
 * 형식이 잘못됐거나 너무 크면 null 을 반환한다 (호출부에서 400 처리).
 */
export async function saveDataUriAvatar(dataUri: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
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
