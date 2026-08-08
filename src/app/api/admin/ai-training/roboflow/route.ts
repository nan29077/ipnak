import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  EMPTY_ROBOFLOW,
  KEY_ROBOFLOW,
  RAW_DIR,
  type RoboflowConfig,
  listRawImages,
  readJson,
  requireSuperAdmin,
  safeFileName,
  writeJson,
} from "@/lib/aiTraining";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Roboflow 연동 (라벨링 옵션 A)
 *
 * GET  → 저장된 설정 조회 (API Key 는 마스킹)
 * PUT  → 설정 저장 { apiKey, workspace, project }
 * POST → 이미지 업로드 { images?: string[], onlyUnlabeled?: boolean }
 *
 * Roboflow Upload API:
 *   POST https://api.roboflow.com/dataset/<project>/upload?api_key=<key>&name=<파일명>
 *   body: multipart/form-data 의 file 필드
 */

const ROBOFLOW_UPLOAD = "https://api.roboflow.com/dataset";
/** 한 번의 요청에서 업로드할 최대 장수 (타임아웃 방지) */
const MAX_UPLOAD_PER_CALL = 50;

/** API Key 마스킹 — 앞 4자리만 노출 */
function maskKey(key: string): string {
  if (!key) return "";
  return key.length <= 4 ? "****" : `${key.slice(0, 4)}${"*".repeat(Math.min(16, key.length - 4))}`;
}

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const cfg = await readJson<RoboflowConfig>(KEY_ROBOFLOW, EMPTY_ROBOFLOW);
  return NextResponse.json({
    configured: Boolean(cfg.apiKey && cfg.project),
    apiKeyMasked: maskKey(cfg.apiKey),
    workspace: cfg.workspace,
    project: cfg.project,
    updatedAt: cfg.updatedAt,
  });
}

export async function PUT(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const prev = await readJson<RoboflowConfig>(KEY_ROBOFLOW, EMPTY_ROBOFLOW);
  const apiKeyInput = String(body.apiKey ?? "").trim();
  const next: RoboflowConfig = {
    // 빈 값으로 저장하면 기존 키를 유지한다 (화면에는 마스킹된 값만 보이므로)
    apiKey: apiKeyInput || prev.apiKey,
    workspace: String(body.workspace ?? "").trim(),
    project: String(body.project ?? "").trim(),
    updatedAt: new Date().toISOString(),
  };

  if (!next.apiKey) return NextResponse.json({ error: "API Key 를 입력해 주세요." }, { status: 400 });
  if (!next.project) return NextResponse.json({ error: "프로젝트 ID 를 입력해 주세요." }, { status: 400 });

  await writeJson(KEY_ROBOFLOW, next);
  return NextResponse.json({ ok: true, apiKeyMasked: maskKey(next.apiKey) });
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const cfg = await readJson<RoboflowConfig>(KEY_ROBOFLOW, EMPTY_ROBOFLOW);
  if (!cfg.apiKey || !cfg.project) {
    return NextResponse.json({ error: "Roboflow 설정을 먼저 저장해 주세요." }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 대상 선정: 지정 목록 > 미라벨 전체 > 전체
  let names: string[];
  if (Array.isArray(body.images) && body.images.length > 0) {
    names = body.images.map((n: any) => safeFileName(String(n))).filter(Boolean) as string[];
  } else {
    const all = await listRawImages();
    names = (body.onlyUnlabeled ? all.filter((i) => !i.labeled) : all).map((i) => i.name);
  }

  if (names.length === 0) return NextResponse.json({ error: "업로드할 이미지가 없습니다." }, { status: 400 });

  const targets = names.slice(0, MAX_UPLOAD_PER_CALL);
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const name of targets) {
    const filePath = join(RAW_DIR, name);
    if (!existsSync(filePath)) {
      failed += 1;
      continue;
    }
    try {
      const buf = await readFile(filePath);
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(buf)]), name);

      const url = `${ROBOFLOW_UPLOAD}/${encodeURIComponent(cfg.project)}/upload?api_key=${encodeURIComponent(cfg.apiKey)}&name=${encodeURIComponent(name)}&split=train`;
      const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
      if (res.ok) {
        uploaded += 1;
      } else {
        failed += 1;
        if (errors.length < 3) errors.push(`${name}: HTTP ${res.status}`);
      }
    } catch (e: any) {
      failed += 1;
      if (errors.length < 3) errors.push(`${name}: ${String(e?.message ?? e).slice(0, 80)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    uploaded,
    failed,
    remaining: Math.max(0, names.length - targets.length),
    errors,
  });
}
