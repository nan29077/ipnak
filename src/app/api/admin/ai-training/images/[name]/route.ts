import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { extname, join } from "path";
import { IMAGE_EXTS, LABELS_DIR, RAW_DIR, labelFileNameFor, requireSuperAdmin, safeFileName } from "@/lib/aiTraining";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * 학습 원본 이미지 서빙 (라벨링 캔버스에서 사용)
 * GET /api/admin/ai-training/images/<파일명>
 *
 * training-data 는 public 밖이라 정적 서빙되지 않으므로 관리자 인증을 거쳐 내려준다.
 */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const name = safeFileName(decodeURIComponent(params.name));
  if (!name) return NextResponse.json({ error: "잘못된 파일명입니다." }, { status: 400 });

  const ext = extname(name).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) {
    return NextResponse.json({ error: "지원하지 않는 형식입니다." }, { status: 400 });
  }

  const filePath = join(RAW_DIR, name);
  if (!existsSync(filePath)) return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });

  try {
    const data = await readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        // 관리자 전용 자료라 공개 캐시에 남기지 않는다
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "읽기에 실패했습니다." }, { status: 500 });
  }
}

/**
 * 학습 이미지 삭제 (라벨 파일도 함께 삭제)
 * DELETE /api/admin/ai-training/images/<파일명>
 */
export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const name = safeFileName(decodeURIComponent(params.name));
  if (!name) return NextResponse.json({ error: "잘못된 파일명입니다." }, { status: 400 });

  const imagePath = join(RAW_DIR, name);
  const labelPath = join(LABELS_DIR, labelFileNameFor(name));

  if (existsSync(imagePath)) await unlink(imagePath).catch(() => {});
  if (existsSync(labelPath)) await unlink(labelPath).catch(() => {});

  return NextResponse.json({ ok: true });
}
