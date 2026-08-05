import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { requireUser } from "@/lib/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// Next.js App Router route handler는 body size 제한이 없다 (formData()는 스트림 처리).
// 413 오류는 앞단 Nginx의 client_max_body_size 때문 — 서버에서 10m 이상으로 설정 필요.
export const maxDuration = 30;

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); }
  catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "파일 파싱 실패" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일 크기가 8MB를 초과합니다." }, { status: 400 });
  }

  const rawExt = extname(file.name).toLowerCase();
  const ext = ALLOWED.includes(rawExt) ? (rawExt === ".heic" || rawExt === ".heif" ? ".jpg" : rawExt) : ".jpg";

  const fileName = `${randomUUID()}${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");

  try {
    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadDir, fileName), Buffer.from(bytes));
  } catch (e) {
    console.error("Upload write error:", e);
    return NextResponse.json({ error: "파일 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ url: `/api/uploads/${fileName}` });
}
