import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  EXPORTS_DIR,
  LABELS_DIR,
  RAW_DIR,
  ensureTrainingDirs,
  labelFileNameFor,
  listRawImages,
  requireSuperAdmin,
} from "@/lib/aiTraining";
import { YOLO_CLASSES } from "@/lib/yolo/types";
import { createZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * YOLO 학습셋 zip 내보내기
 * GET /api/admin/ai-training/export?split=0.2
 *
 * 결과 구조 (Ultralytics 표준 레이아웃):
 *   data.yaml
 *   images/train/*.jpg   labels/train/*.txt
 *   images/val/*.jpg     labels/val/*.txt
 *
 * 라벨이 있는 이미지만 포함한다.
 */

/** 파일명을 결정적으로 섞기 위한 간단한 해시 (재실행해도 같은 분할이 나온다) */
function hashToUnit(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export async function GET(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const valRatio = Math.min(0.5, Math.max(0, Number(searchParams.get("split")) || 0.2));
  const save = searchParams.get("save") === "1";

  await ensureTrainingDirs();
  const images = (await listRawImages()).filter((i) => i.labeled);
  if (images.length === 0) {
    return NextResponse.json({ error: "라벨링된 이미지가 없습니다." }, { status: 400 });
  }

  const entries: { name: string; data: Buffer }[] = [];
  let trainCount = 0;
  let valCount = 0;

  for (const img of images) {
    // 파일명 해시로 train/val 을 나눈다 — 같은 데이터셋이면 항상 같은 분할
    const isVal = hashToUnit(img.name) < valRatio;
    const split = isVal ? "val" : "train";
    try {
      const imageBuf = await readFile(join(RAW_DIR, img.name));
      const labelName = labelFileNameFor(img.name);
      const labelBuf = await readFile(join(LABELS_DIR, labelName)).catch(() => Buffer.from(""));
      entries.push({ name: `images/${split}/${img.name}`, data: imageBuf });
      entries.push({ name: `labels/${split}/${labelName}`, data: labelBuf });
      if (isVal) valCount += 1;
      else trainCount += 1;
    } catch {
      /* 개별 파일 오류는 건너뛴다 */
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "내보낼 파일을 읽지 못했습니다." }, { status: 500 });
  }

  // Ultralytics data.yaml — 클래스 순서는 src/lib/yolo/types.ts 와 동일해야 한다
  const yaml = [
    "# 입낚 YOLO 학습 데이터셋",
    "# Ultralytics YOLOv8 형식 — Colab 에서 이 파일 경로를 data= 인자로 넘긴다",
    "path: .",
    "train: images/train",
    "val: images/val",
    "",
    `nc: ${YOLO_CLASSES.length}`,
    `names: [${YOLO_CLASSES.map((c) => `"${c}"`).join(", ")}]`,
    "",
  ].join("\n");
  entries.unshift({ name: "data.yaml", data: Buffer.from(yaml, "utf8") });

  const zip = createZip(entries);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "").replace(/-/g, "");
  const fileName = `ipnak-yolo-${stamp}.zip`;

  // save=1 이면 서버의 exports 폴더에도 사본을 남긴다
  if (save) {
    await writeFile(join(EXPORTS_DIR, fileName), zip).catch(() => {});
  }

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(zip.length),
      "X-Train-Count": String(trainCount),
      "X-Val-Count": String(valCount),
      "Cache-Control": "no-store",
    },
  });
}
