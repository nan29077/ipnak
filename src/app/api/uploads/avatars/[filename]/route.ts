import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";

// /api/uploads/avatars/<파일명> — 프로필 사진 파일 제공
// (기존 /api/uploads/[filename] 라우트는 단일 세그먼트만 처리하므로 avatars 하위 전용 라우트를 둔다)

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  // 경로 탐색 공격 방지
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = join(process.cwd(), "public", "uploads", "avatars", filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filename).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Read error" }, { status: 500 });
  }
}
