import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { extname, join } from "path";

export const dynamic = "force-dynamic";

/**
 * YOLO 모델 파일 서빙
 * GET|HEAD /api/models/best.onnx
 *
 * public/uploads 와 같은 이유로 API 라우트를 쓴다 —
 * 실서버 standalone 빌드에서는 런타임에 추가된 public/ 파일이 정적 서빙되지 않는다.
 *
 * HEAD 는 클라이언트가 "모델이 있는지"만 확인할 때 쓰므로 본문 없이 200/404 만 돌려준다.
 * (모델 파일은 로그인 없이도 내려받을 수 있어야 AI 카메라가 동작한다 — 공개 자원)
 */

const MIME: Record<string, string> = {
  ".onnx": "application/octet-stream",
  ".json": "application/json",
  ".bin": "application/octet-stream",
};

/** 파일명 검증 — 경로 탐색 차단 + 허용 확장자만 */
function resolveModelPath(raw: string): string | null {
  const filename = decodeURIComponent(raw);
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  if (!MIME[extname(filename).toLowerCase()]) return null;
  return join(process.cwd(), "public", "models", filename);
}

export async function HEAD(_req: Request, { params }: { params: { filename: string } }) {
  const filePath = resolveModelPath(params.filename);
  if (!filePath || !existsSync(filePath)) return new Response(null, { status: 404 });
  const s = await stat(filePath).catch(() => null);
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": MIME[extname(filePath).toLowerCase()],
      "Content-Length": String(s?.size ?? 0),
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET(_req: Request, { params }: { params: { filename: string } }) {
  const filePath = resolveModelPath(params.filename);
  if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  if (!existsSync(filePath)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await readFile(filePath);
    const s = await stat(filePath).catch(() => null);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[extname(filePath).toLowerCase()],
        "Content-Length": String(data.length),
        // 모델 교체를 즉시 반영해야 하므로 강한 캐시를 걸지 않는다.
        // mtime 을 ETag 로 써서 내용이 같으면 304 로 재사용된다.
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: `"${s?.mtimeMs ?? 0}-${data.length}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Read error" }, { status: 500 });
  }
}
