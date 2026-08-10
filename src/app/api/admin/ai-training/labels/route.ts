import { NextResponse } from "next/server";
import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  LABELS_DIR,
  RAW_DIR,
  ensureTrainingDirs,
  formatLabelText,
  labelFileNameFor,
  parseLabelText,
  requireSuperAdmin,
  safeFileName,
  sanitizeBoxes,
} from "@/lib/aiTraining";

export const dynamic = "force-dynamic";

/**
 * YOLO 라벨 조회 / 저장 / 삭제
 *
 * 라벨 파일 포맷 (한 줄 = 박스 1개, 모두 0~1 정규화):
 *   <class_id> <center_x> <center_y> <width> <height>
 *
 * GET    ?image=<파일명>        → { boxes: [...] }
 * POST   { image, boxes }       → 저장 (박스 0개면 "물체 없음" 샘플로 빈 파일 저장)
 * DELETE ?image=<파일명>        → 라벨 삭제 (라벨링 취소)
 */

export async function GET(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const image = safeFileName(searchParams.get("image") ?? "");
  if (!image) return NextResponse.json({ error: "이미지를 지정해 주세요." }, { status: 400 });

  const labelPath = join(LABELS_DIR, labelFileNameFor(image));
  if (!existsSync(labelPath)) return NextResponse.json({ image, boxes: [], labeled: false });

  const text = await readFile(labelPath, "utf8").catch(() => "");
  return NextResponse.json({ image, boxes: parseLabelText(text), labeled: true });
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const image = safeFileName(String(body.image ?? ""));
  if (!image) return NextResponse.json({ error: "이미지를 지정해 주세요." }, { status: 400 });
  if (!existsSync(join(RAW_DIR, image))) {
    return NextResponse.json({ error: "원본 이미지를 찾을 수 없습니다." }, { status: 404 });
  }

  const boxes = sanitizeBoxes(body.boxes);

  await ensureTrainingDirs();
  const labelPath = join(LABELS_DIR, labelFileNameFor(image));
  // 박스가 0개여도 파일은 만든다 — YOLO 에서 "물체 없음(negative sample)"으로 학습에 쓰인다
  await writeFile(labelPath, formatLabelText(boxes), "utf8");

  return NextResponse.json({ ok: true, image, saved: boxes.length });
}

export async function DELETE(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const image = safeFileName(searchParams.get("image") ?? "");
  if (!image) return NextResponse.json({ error: "이미지를 지정해 주세요." }, { status: 400 });

  const labelPath = join(LABELS_DIR, labelFileNameFor(image));
  if (existsSync(labelPath)) await unlink(labelPath).catch(() => {});
  return NextResponse.json({ ok: true });
}
