import "server-only";
/**
 * AI 학습 데이터 관리 공용 서버 유틸
 *
 * - 학습 이미지/라벨은 저장소 루트의 `training-data/` 아래에 둔다 (서비스 이미지와 분리).
 * - 수집 이력·선별 상태 같은 메타데이터는 **Setting 테이블(key-value JSON)** 에 저장한다.
 *   → Prisma 스키마를 건드리지 않으므로 기존 DB/기능에 영향이 없다.
 */
import { mkdir, readdir, stat, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, basename } from "path";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";

/* ────────────────────────────── 경로 ────────────────────────────── */

export const TRAINING_ROOT = join(process.cwd(), "training-data");
export const RAW_DIR = join(TRAINING_ROOT, "raw");
export const LABELED_DIR = join(TRAINING_ROOT, "labeled");
export const LABELS_DIR = join(TRAINING_ROOT, "labels");
export const EXPORTS_DIR = join(TRAINING_ROOT, "exports");
export const MODELS_DIR = join(process.cwd(), "public", "models");

/** 학습용으로 허용하는 이미지 확장자 */
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

/** 필요한 폴더를 만들어 둔다 (이미 있으면 통과) */
export async function ensureTrainingDirs() {
  await Promise.all(
    [RAW_DIR, LABELED_DIR, LABELS_DIR, EXPORTS_DIR, MODELS_DIR].map((d) => mkdir(d, { recursive: true })),
  );
}

/**
 * 경로 탐색(../) 차단 — 파일명만 허용한다.
 * 외부에서 들어온 파일명은 반드시 이 함수를 통과시킨 뒤 join 한다.
 */
export function safeFileName(name: string): string | null {
  if (!name) return null;
  if (name.includes("..") || name.includes("/") || name.includes("\\") || name.includes("\0")) return null;
  if (name !== basename(name)) return null;
  return name;
}

/** 이미지 파일명 → 라벨 파일명 (`bass_01.jpg` → `bass_01.txt`) */
export function labelFileNameFor(imageName: string): string {
  const ext = extname(imageName);
  return `${imageName.slice(0, imageName.length - ext.length)}.txt`;
}

/* ────────────────────────── 권한 확인 ────────────────────────── */

/**
 * SUPER_ADMIN 확인. 통과하면 user, 아니면 null.
 * 라우트에서 `if (!(await requireSuperAdmin())) return forbidden()` 형태로 사용한다.
 */
export async function requireSuperAdmin() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

/* ─────────────────────── Setting 기반 상태 저장 ─────────────────────── */

/** 수집 진행 상태 (실행 중/완료) */
export const KEY_COLLECT_STATE = "ai_training_collect_state";
/** 수집 이력 목록 */
export const KEY_COLLECT_HISTORY = "ai_training_collect_history";
/** 학습 후보로 선정된 피드 이미지 URL 목록 */
export const KEY_FEED_SELECTION = "ai_training_feed_selection";
/** Roboflow 연동 설정 */
export const KEY_ROBOFLOW = "ai_training_roboflow";
/** 현재 배포된 모델 메타 정보 */
export const KEY_MODEL_META = "ai_training_model_meta";
/** 최근 학습(모델 업로드) 시각 */
export const KEY_LAST_TRAINED = "ai_training_last_trained";

/** Setting 값을 JSON 으로 읽는다. 없거나 깨졌으면 fallback */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
    if (!row?.value) return fallback;
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

/** Setting 값을 JSON 으로 저장한다 */
export async function writeJson(key: string, value: unknown): Promise<void> {
  const str = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: str },
    update: { value: str },
  });
}

/* ────────────────────────── 타입 ────────────────────────── */

export type CollectSource = "inaturalist" | "feed";

/**
 * iNaturalist 수집 프리셋 — 값은 학명(taxon_name)이다.
 * 학명을 쓰면 한글/영문 표기 차이와 무관하게 정확한 분류군을 검색할 수 있다.
 */
export const KEYWORD_PRESETS: Record<string, string[]> = {
  /** 조기어강 전체 — 사실상 "모든 물고기" */
  all: ["Actinopterygii"],
  /** 국내 낚시에서 자주 잡히는 10종 */
  korea: [
    "Micropterus salmoides",    // 배스
    "Carassius auratus",        // 붕어
    "Cyprinus carpio",          // 잉어
    "Paralichthys olivaceus",   // 광어(넙치)
    "Sebastes schlegelii",      // 우럭(조피볼락)
    "Lateolabrax japonicus",    // 농어
    "Acanthopagrus schlegelii", // 감성돔
    "Pagrus major",             // 참돔
    "Seriola quinqueradiata",   // 방어
    "Scomber japonicus",        // 고등어
  ],
};

export const PRESET_LABEL: Record<string, string> = {
  all: "전체 어류",
  korea: "한국 어류 10종",
};

/** 수집 이력 1건 */
export interface CollectHistoryItem {
  id: string;
  source: CollectSource;
  /** 검색 키워드(또는 프리셋 이름) */
  keyword: string;
  /** 요청 수량 */
  requested: number;
  /** 실제 저장된 수 */
  saved: number;
  /** 중복 등으로 건너뛴 수 */
  skipped: number;
  /** 실패 수 */
  failed: number;
  startedAt: string;
  finishedAt: string;
}

/** 진행 중인 수집 작업 상태 */
export interface CollectState {
  running: boolean;
  keyword: string;
  requested: number;
  saved: number;
  skipped: number;
  failed: number;
  /** 사람이 읽는 진행 메시지 */
  message: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export const EMPTY_COLLECT_STATE: CollectState = {
  running: false,
  keyword: "",
  requested: 0,
  saved: 0,
  skipped: 0,
  failed: 0,
  message: "",
  startedAt: "",
  updatedAt: "",
};

/** Roboflow 연동 설정 (API Key 는 서버에만 보관하고 화면에는 마스킹해 내려준다) */
export interface RoboflowConfig {
  apiKey: string;
  workspace: string;
  project: string;
  updatedAt: string;
}

export const EMPTY_ROBOFLOW: RoboflowConfig = { apiKey: "", workspace: "", project: "", updatedAt: "" };

/** 배포된 모델 메타 */
export interface ModelMeta {
  fileName: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  note: string;
}

/* ────────────────────── YOLO 라벨 포맷 ────────────────────── */

/** 라벨 박스 1개 — 모두 0~1 정규화, cx/cy 는 박스 중심 */
export interface LabelBox {
  classId: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** 0~1 범위로 자른다 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 학습 클래스 개수 (fish / ipnak-ball / ipnak-keyring) */
export const LABEL_CLASS_COUNT = 3;

/**
 * 라벨 텍스트 → 박스 목록.
 * 형식이 깨진 줄은 조용히 건너뛴다 (외부 툴에서 만든 파일도 최대한 살린다).
 */
export function parseLabelText(text: string): LabelBox[] {
  const boxes: LabelBox[] = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [classId, cx, cy, w, h] = parts.slice(0, 5).map(Number);
    if (![classId, cx, cy, w, h].every((n) => Number.isFinite(n))) continue;
    if (classId < 0 || classId >= LABEL_CLASS_COUNT) continue;
    if (w <= 0 || h <= 0) continue;
    boxes.push({ classId, cx: clamp01(cx), cy: clamp01(cy), w: clamp01(w), h: clamp01(h) });
  }
  return boxes;
}

/** 박스 목록 → YOLO 라벨 텍스트 (소수 6자리) */
export function formatLabelText(boxes: LabelBox[]): string {
  return boxes
    .map((b) => `${b.classId} ${b.cx.toFixed(6)} ${b.cy.toFixed(6)} ${b.w.toFixed(6)} ${b.h.toFixed(6)}`)
    .join("\n");
}

/** 외부 입력(JSON)에서 안전한 박스 목록만 추려낸다 */
export function sanitizeBoxes(input: unknown): LabelBox[] {
  if (!Array.isArray(input)) return [];
  const out: LabelBox[] = [];
  for (const b of input) {
    const classId = Number((b as any)?.classId);
    const cx = Number((b as any)?.cx);
    const cy = Number((b as any)?.cy);
    const w = Number((b as any)?.w);
    const h = Number((b as any)?.h);
    if (![classId, cx, cy, w, h].every((n) => Number.isFinite(n))) continue;
    if (classId < 0 || classId >= LABEL_CLASS_COUNT) continue;
    // 지나치게 작은 박스(변 길이 0.5% 미만)는 오조작으로 보고 버린다
    if (w < 0.005 || h < 0.005) continue;
    out.push({ classId, cx: clamp01(cx), cy: clamp01(cy), w: clamp01(w), h: clamp01(h) });
  }
  return out;
}

/* ────────────────────────── 파일 조회 ────────────────────────── */

export interface RawImageInfo {
  name: string;
  size: number;
  modifiedAt: string;
  /** 라벨 파일 존재 여부 */
  labeled: boolean;
  /** 라벨 박스 개수 (없으면 0) */
  boxCount: number;
}

/** raw 폴더의 이미지 목록 (라벨 여부 포함) */
export async function listRawImages(): Promise<RawImageInfo[]> {
  await ensureTrainingDirs();
  let names: string[] = [];
  try {
    names = await readdir(RAW_DIR);
  } catch {
    return [];
  }
  const images = names.filter((n) => IMAGE_EXTS.includes(extname(n).toLowerCase()));
  const out: RawImageInfo[] = [];
  for (const name of images) {
    try {
      const s = await stat(join(RAW_DIR, name));
      const labelPath = join(LABELS_DIR, labelFileNameFor(name));
      let boxCount = 0;
      let labeled = false;
      if (existsSync(labelPath)) {
        const txt = await readFile(labelPath, "utf8").catch(() => "");
        const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
        boxCount = lines.length;
        // 빈 파일은 "라벨 안 함"이 아니라 "물체 없음"으로 저장된 것이므로 라벨 완료로 본다
        labeled = true;
      }
      out.push({
        name,
        size: s.size,
        modifiedAt: s.mtime.toISOString(),
        labeled,
        boxCount,
      });
    } catch {
      /* 개별 파일 오류는 건너뛴다 */
    }
  }
  // 최근 파일 우선
  out.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  return out;
}

/** 학습 현황 통계 */
export interface TrainingStats {
  rawCount: number;
  labeledCount: number;
  boxCount: number;
  lastCollectedAt: string | null;
  lastTrainedAt: string | null;
  selectedFeedCount: number;
  modelReady: boolean;
  modelMeta: ModelMeta | null;
}

export async function getTrainingStats(): Promise<TrainingStats> {
  const images = await listRawImages();
  const history = await readJson<CollectHistoryItem[]>(KEY_COLLECT_HISTORY, []);
  const selection = await readJson<string[]>(KEY_FEED_SELECTION, []);
  const modelMeta = await readJson<ModelMeta | null>(KEY_MODEL_META, null);
  const lastTrained = await readJson<string | null>(KEY_LAST_TRAINED, null);

  return {
    rawCount: images.length,
    labeledCount: images.filter((i) => i.labeled).length,
    boxCount: images.reduce((sum, i) => sum + i.boxCount, 0),
    lastCollectedAt: history[0]?.finishedAt ?? null,
    lastTrainedAt: lastTrained,
    selectedFeedCount: selection.length,
    modelReady: existsSync(join(MODELS_DIR, "best.onnx")),
    modelMeta,
  };
}

/* ────────────────────── 이미지 저장 (수집 공용) ────────────────────── */

/** URL 확장자 추론 — 알 수 없으면 .jpg */
export function extFromUrl(url: string): string {
  try {
    const path = new URL(url, "http://x").pathname.toLowerCase();
    const e = extname(path);
    return IMAGE_EXTS.includes(e) ? e : ".jpg";
  } catch {
    return ".jpg";
  }
}

/** 이미지 1장을 raw 폴더에 저장한다. 이미 있으면 false (중복) */
export async function saveRawImage(fileName: string, data: Buffer): Promise<boolean> {
  const safe = safeFileName(fileName);
  if (!safe) return false;
  const dest = join(RAW_DIR, safe);
  if (existsSync(dest)) return false;
  await writeFile(dest, data);
  return true;
}
