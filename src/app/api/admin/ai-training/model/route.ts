import { NextResponse } from "next/server";
import { writeFile, rename, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  KEY_LAST_TRAINED,
  KEY_MODEL_META,
  MODELS_DIR,
  type ModelMeta,
  ensureTrainingDirs,
  readJson,
  requireSuperAdmin,
  writeJson,
} from "@/lib/aiTraining";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 서비스 모델 관리
 *
 * GET  → 현재 배포된 모델 정보
 * POST → .onnx 업로드 (multipart/form-data, file 필드) → public/models/best.onnx 교체
 *
 * 업로드 즉시 서비스에 적용된다. 클라이언트 캐시는 화면에서 resetYoloModel() 로 비운다.
 */

const MODEL_NAME = "best.onnx";
/** ONNX 모델 최대 크기 — YOLOv8n 은 보통 12MB 내외지만 여유를 둔다 */
const MAX_BYTES = 200 * 1024 * 1024;
/** ONNX 파일은 protobuf 라 고정 매직넘버가 없다 — 최소 크기와 확장자로만 1차 검증한다 */
const MIN_BYTES = 1024;

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const modelPath = join(MODELS_DIR, MODEL_NAME);
  const meta = await readJson<ModelMeta | null>(KEY_MODEL_META, null);

  if (!existsSync(modelPath)) {
    return NextResponse.json({ exists: false, meta: null, servePath: `/api/models/${MODEL_NAME}` });
  }

  const s = await stat(modelPath).catch(() => null);
  return NextResponse.json({
    exists: true,
    servePath: `/api/models/${MODEL_NAME}`,
    file: {
      name: MODEL_NAME,
      size: s?.size ?? 0,
      modifiedAt: s?.mtime.toISOString() ?? "",
    },
    meta,
  });
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".onnx")) {
    return NextResponse.json({ error: ".onnx 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일이 너무 큽니다. (최대 200MB)" }, { status: 400 });
  }
  if (file.size < MIN_BYTES) {
    return NextResponse.json({ error: "파일이 손상된 것 같습니다." }, { status: 400 });
  }

  const note = String(form.get("note") ?? "").slice(0, 200);
  const buf = Buffer.from(await file.arrayBuffer());

  await ensureTrainingDirs();
  const dest = join(MODELS_DIR, MODEL_NAME);
  const tmp = join(MODELS_DIR, `.${MODEL_NAME}.uploading`);

  try {
    // 임시 파일에 먼저 쓴 뒤 교체 — 업로드 도중 서비스가 반쯤 쓰인 모델을 읽는 일을 막는다
    await writeFile(tmp, buf);
    if (existsSync(dest)) await unlink(dest).catch(() => {});
    await rename(tmp, dest);
  } catch (e: any) {
    await unlink(tmp).catch(() => {});
    return NextResponse.json({ error: "모델 저장에 실패했습니다." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const meta: ModelMeta = {
    fileName: file.name,
    size: buf.length,
    uploadedAt: now,
    uploadedBy: admin.nickname ?? "",
    note,
  };
  await writeJson(KEY_MODEL_META, meta);
  await writeJson(KEY_LAST_TRAINED, now);

  return NextResponse.json({ ok: true, meta, servePath: `/api/models/${MODEL_NAME}` });
}

/** 모델 삭제 — YOLO 를 끄고 기존 감지 방식으로 되돌린다 */
export async function DELETE() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const dest = join(MODELS_DIR, MODEL_NAME);
  if (existsSync(dest)) await unlink(dest).catch(() => {});
  await writeJson(KEY_MODEL_META, null);
  return NextResponse.json({ ok: true });
}
