import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { requireUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Next.js App Router route handler는 body size 제한이 없다 (formData()는 스트림 처리).
// 413 오류는 앞단 Nginx의 client_max_body_size 때문 — 서버에서 10m 이상으로 설정 필요.
export const maxDuration = 30;

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DAILY_UPLOAD_LIMIT = 50; // 회원별 일일 업로드 횟수 제한
const DAY_MS = 24 * 60 * 60 * 1000;

/** 이미지 종류 감지 결과 → 허용 확장자 목록 */
type DetectedType = "jpeg" | "png" | "gif" | "webp" | "heic";
const TYPE_EXTS: Record<DetectedType, string[]> = {
  jpeg: [".jpg", ".jpeg"],
  png: [".png"],
  gif: [".gif"],
  webp: [".webp"],
  heic: [".heic", ".heif"],
};

/** 파일 앞부분(매직 바이트)으로 실제 이미지 형식을 감지한다. 이미지가 아니면 null. */
function detectImageType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // GIF: 47 49 46 ("GIF")
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  // WEBP: 52 49 46 46 ("RIFF") + offset 8~11 "WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return buf.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
  }
  // HEIC/HEIF: offset 4~7 "ftyp" (ISO BMFF 컨테이너)
  if (buf.toString("ascii", 4, 8) === "ftyp") return "heic";
  return null;
}

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); }
  catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  // 회원별 일일 업로드 횟수 제한 (인메모리 — 재시작 시 초기화)
  if (!rateLimit(`upload:${user.id}`, DAILY_UPLOAD_LIMIT, DAY_MS)) {
    return NextResponse.json({ error: "하루 업로드 한도를 초과했습니다. 내일 다시 시도해주세요." }, { status: 429 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "파일 파싱 실패" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일 크기가 10MB를 초과합니다." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "파일 파싱 실패" }, { status: 400 });
  }

  // ── 매직 바이트 검증: 실제 이미지 파일만 허용 ──
  const detected = detectImageType(buffer);
  if (!detected) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const rawExt = extname(file.name).toLowerCase();
  if (ALLOWED.includes(rawExt) && !TYPE_EXTS[detected].includes(rawExt)) {
    // 확장자와 실제 파일 형식 불일치 (예: .png 로 위장한 다른 형식)
    return NextResponse.json({ error: "파일 확장자와 실제 파일 형식이 일치하지 않습니다." }, { status: 400 });
  }

  // 확장자 결정 — 기존 동작 유지: heic/heif 는 .jpg 로 저장, 알 수 없는 확장자는 감지된 형식 기준
  let ext: string;
  if (ALLOWED.includes(rawExt)) {
    ext = rawExt === ".heic" || rawExt === ".heif" ? ".jpg" : rawExt;
  } else {
    ext = detected === "heic" ? ".jpg" : TYPE_EXTS[detected][0];
  }

  const fileName = `${randomUUID()}${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");

  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), buffer);
  } catch (e) {
    console.error("Upload write error:", e);
    return NextResponse.json({ error: "파일 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ url: `/api/uploads/${fileName}` });
}
