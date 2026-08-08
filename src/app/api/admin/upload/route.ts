import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// /api/upload 와 동일한 검증 정책 (확장자 화이트리스트 + 크기 제한)
const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "파일 크기가 8MB를 초과합니다." }, { status: 400 });
    }

    const rawExt = extname(file.name).toLowerCase();
    const ext = ALLOWED.includes(rawExt) ? (rawExt === ".heic" || rawExt === ".heif" ? ".jpg" : rawExt) : ".jpg";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `ipnak-ball-${randomUUID()}${ext}`;

    await writeFile(join(uploadsDir, filename), buffer);

    // 실서버 standalone 빌드에서는 public/uploads 정적 서빙이 안 되므로 /api/uploads 라우트로 서빙한다
    return NextResponse.json({ url: `/api/uploads/${filename}` });
  } catch (e: any) {
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
