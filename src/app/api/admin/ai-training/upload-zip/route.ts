import { NextResponse } from "next/server";
import {
  RAW_DIR,
  LABELS_DIR,
  IMAGE_EXTS,
  ensureTrainingDirs,
  requireSuperAdmin,
  safeFileName,
  KEY_COLLECT_HISTORY,
  type CollectHistoryItem,
  readJson,
  writeJson,
} from "@/lib/aiTraining";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, basename } from "path";

export const dynamic = "force-dynamic";
// zip 파일이 클 수 있으므로 최대 크기 제한을 넉넉하게 설정 (500MB)
export const maxDuration = 120;

/**
 * POST /api/admin/ai-training/upload-zip
 *
 * multipart/form-data 로 YOLOv8 zip 파일을 받아 서버에 저장한다.
 * - train/images/, valid/images/, test/images/ 아래 이미지 → training-data/raw/
 * - train/labels/, valid/labels/, test/labels/ 아래 라벨 → training-data/labels/
 * - 중복 파일은 덮어쓰지 않고 건너뛴다
 */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "파일 업로드에 실패했습니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "zip 파일이 없습니다." }, { status: 400 });
  }

  // 파일 크기 제한: 500MB
  if (file.size > 500 * 1024 * 1024) {
    return NextResponse.json({ error: "파일이 너무 큽니다. (최대 500MB)" }, { status: 413 });
  }

  await ensureTrainingDirs();

  // zip 파싱 (Node.js 내장 없음 → unzipper 없이 수동 파싱)
  // Next.js 서버 환경에서는 adm-zip 또는 fflate 사용
  let AdmZip: any;
  try {
    AdmZip = (await import("adm-zip")).default;
  } catch {
    return NextResponse.json(
      { error: "서버에 adm-zip 패키지가 없습니다. npm install adm-zip 을 실행해 주세요." },
      { status: 500 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let zip: any;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 zip 파일입니다." }, { status: 400 });
  }

  const entries: any[] = zip.getEntries();

  let savedImages = 0;
  let savedLabels = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName: string = entry.entryName; // e.g. "train/images/fish_001.jpg"
    const fileName = basename(entryName);
    const ext = extname(fileName).toLowerCase();

    // 이미지 파일: train/images/, valid/images/, test/images/ 경로에 있는 것
    const isImage = IMAGE_EXTS.includes(ext) &&
      /\/(images|train\/images|valid\/images|test\/images)\//i.test(entryName);

    // 라벨 파일: .txt 파일 중 images/ 경로에 있지 않은 것 (labels/ 경로)
    const isLabel = ext === ".txt" &&
      /\/(labels|train\/labels|valid\/labels|test\/labels)\//i.test(entryName);

    if (isImage) {
      const safeName = safeFileName(fileName);
      if (!safeName) { skipped++; continue; }
      const dest = join(RAW_DIR, safeName);
      if (existsSync(dest)) { skipped++; continue; }
      try {
        const data = entry.getData() as Buffer;
        if (data.length < 1024) { skipped++; continue; } // 깨진 이미지
        await writeFile(dest, data);
        savedImages++;
      } catch (e: any) {
        errors.push(`이미지 저장 실패: ${fileName}`);
      }
    } else if (isLabel) {
      const safeName = safeFileName(fileName);
      if (!safeName) { skipped++; continue; }
      const dest = join(LABELS_DIR, safeName);
      if (existsSync(dest)) { skipped++; continue; }
      try {
        const data = entry.getData() as Buffer;
        await writeFile(dest, data);
        savedLabels++;
      } catch (e: any) {
        errors.push(`라벨 저장 실패: ${fileName}`);
      }
    }
  }

  // 수집 이력에 기록
  const startedAt = new Date().toISOString();
  const history = await readJson<CollectHistoryItem[]>(KEY_COLLECT_HISTORY, []);
  const item: CollectHistoryItem = {
    id: `${Date.now()}`,
    source: "inaturalist" as any, // 기존 타입 재사용 (roboflow-zip 으로 표시)
    keyword: `Roboflow ZIP (이미지 ${savedImages}장, 라벨 ${savedLabels}개)`,
    requested: savedImages + skipped,
    saved: savedImages,
    skipped,
    failed: errors.length,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  await writeJson(KEY_COLLECT_HISTORY, [item, ...history].slice(0, 50));

  return NextResponse.json({
    ok: true,
    savedImages,
    savedLabels,
    skipped,
    errors: errors.slice(0, 10),
  });
}
