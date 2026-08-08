"use client";
/**
 * YOLO ONNX 모델 지연 로딩 + 싱글턴 캐싱
 *
 * ── onnxruntime-web 을 왜 번들에 넣지 않는가 ─────────────────────────────
 * onnxruntime-web 배포본은 ESM 워커(`new Worker(..., {type:"module"})`)를 포함하는데,
 * Next.js(webpack + Terser)가 이 파일을 정적 asset 으로 뽑아내 클래식 스크립트로
 * 최소화하려다 실패한다("'import' cannot be used outside of module code").
 *
 * 그래서 `/* webpackIgnore: true *\/` 로 **런타임 동적 import** 를 쓴다.
 * 브라우저가 ESM 을 직접 로드하므로 번들러가 관여하지 않고,
 * 측정 화면을 열지 않은 사용자는 파일을 내려받지도 않는다.
 *
 * ── 로드 위치 ────────────────────────────────────────────────────────
 * 1) NEXT_PUBLIC_ORT_BASE 환경변수가 있으면 그 경로
 * 2) 없으면 자체 호스팅 `/ort/` (npm run yolo:wasm 으로 복사)
 * 3) 그것도 없으면 jsDelivr CDN (웹에서는 설정 없이 바로 동작)
 *
 * 어느 단계에서 실패하든 `loadYoloModel` 은 null 을 돌려주고,
 * 호출부(AI 카메라)는 기존 감지 방식으로 그대로 진행한다.
 */
import type { ModelConfig } from "./types";
import { YOLO_CLASSES } from "./types";

/** 타입 전용 import — 컴파일 시 제거되므로 번들에 들어가지 않는다 */
type OrtModule = typeof import("onnxruntime-web/wasm");

/** 설치된 onnxruntime-web 버전 — CDN 폴백 경로에 사용 (package.json 과 맞춰 둘 것) */
const ORT_VERSION = "1.27.0";
const ORT_ENTRY = "ort.wasm.bundle.min.mjs";
const ORT_LOCAL_BASE = "/ort/";
const ORT_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
/** 모델 배포 여부 확인용 상태 라우트 (항상 200 — 콘솔에 404 를 남기지 않는다) */
const MODEL_STATUS_URL = "/api/models/status";

/** 기본 설정 — loadYoloModel(부분설정) 으로 덮어쓸 수 있다 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  modelUrl: "/api/models/best.onnx",
  inputSize: 640,
  scoreThreshold: 0.5,
  iouThreshold: 0.45,
  maxDetections: 20,
  classNames: YOLO_CLASSES,
  executionProviders: ["wasm"],
  wasmPath: process.env.NEXT_PUBLIC_ORT_BASE || undefined,
};

let ortPromise: Promise<OrtModule | null> | null = null;
let sessionPromise: Promise<any> | null = null;
let loadedConfig: ModelConfig | null = null;
let availability: boolean | null = null;
let availabilityPromise: Promise<boolean> | null = null;

/** 해당 URL 이 실제로 존재하는지 (HEAD 1회) */
async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** onnxruntime-web 을 어디서 불러올지 결정한다 */
async function resolveOrtBase(configured?: string): Promise<string> {
  if (configured) return configured.endsWith("/") ? configured : `${configured}/`;
  if (await headOk(`${ORT_LOCAL_BASE}${ORT_ENTRY}`)) return ORT_LOCAL_BASE;
  return ORT_CDN_BASE;
}

/**
 * onnxruntime-web 을 한 번만 로드하고 실행 환경을 설정한다.
 * 실패하면 null (호출부는 기존 흐름 유지).
 */
export function getOrt(config: ModelConfig = DEFAULT_MODEL_CONFIG): Promise<OrtModule | null> {
  if (!ortPromise) {
    ortPromise = (async () => {
      try {
        const base = await resolveOrtBase(config.wasmPath);
        // webpackIgnore — 번들러가 이 import 를 건드리지 않고 브라우저가 직접 로드한다
        const ort: OrtModule = await import(/* webpackIgnore: true */ `${base}${ORT_ENTRY}`);
        // .wasm 바이너리도 같은 위치에서 받는다
        ort.env.wasm.wasmPaths = base;
        // 멀티스레드는 SharedArrayBuffer(교차 출처 격리)가 필요하다.
        // 모바일 웹뷰에서 조건이 안 맞으면 초기화가 실패하므로 단일 스레드로 고정한다.
        ort.env.wasm.numThreads = 1;
        ort.env.logLevel = "error";
        return ort;
      } catch (e) {
        console.warn("[yolo] onnxruntime-web 로드 실패 — 기존 감지 방식으로 동작합니다.", e);
        return null;
      }
    })();
  }
  return ortPromise;
}

/**
 * 모델 배포 여부 확인 (요청 1회, 결과 캐싱).
 * 모델이 없으면 YOLO 기능 전체가 꺼지고 기존 감지 흐름만 사용된다.
 *
 * 모델 파일에 직접 HEAD 를 날리면 미배포 상태에서 브라우저 콘솔에 404 가 남으므로,
 * 항상 200 을 돌려주는 상태 라우트를 먼저 쓴다. 기본 경로가 아닐 때만 HEAD 로 확인한다.
 */
export function isYoloModelAvailable(modelUrl: string = DEFAULT_MODEL_CONFIG.modelUrl): Promise<boolean> {
  if (availability !== null) return Promise.resolve(availability);
  if (availabilityPromise) return availabilityPromise;
  availabilityPromise = (async () => {
    if (typeof fetch === "undefined") return false;
    if (modelUrl === DEFAULT_MODEL_CONFIG.modelUrl) {
      try {
        const res = await fetch(MODEL_STATUS_URL, { cache: "no-store" });
        availability = res.ok ? Boolean((await res.json())?.available) : false;
      } catch {
        availability = false;
      }
    } else {
      availability = await headOk(modelUrl);
    }
    availabilityPromise = null;
    return availability;
  })();
  return availabilityPromise;
}

/**
 * ONNX 세션을 지연 로드한다 (싱글턴).
 * 모델이 없거나 로드에 실패하면 null — 예외를 던지지 않는다.
 */
export async function loadYoloModel(overrides: Partial<ModelConfig> = {}): Promise<any | null> {
  const config: ModelConfig = { ...DEFAULT_MODEL_CONFIG, ...overrides };
  // 모델 URL 이 바뀌었으면 기존 세션을 버린다
  if (loadedConfig && loadedConfig.modelUrl !== config.modelUrl) resetYoloModel();
  if (sessionPromise) return sessionPromise;

  loadedConfig = config;
  sessionPromise = (async () => {
    if (!(await isYoloModelAvailable(config.modelUrl))) return null;
    const ort = await getOrt(config);
    if (!ort) return null;
    try {
      return await ort.InferenceSession.create(config.modelUrl, {
        executionProviders: config.executionProviders as any,
        graphOptimizationLevel: "all",
      });
    } catch (e) {
      // 모델 손상·형식 불일치 등 — 조용히 비활성화 (기존 흐름 유지)
      console.warn("[yolo] 모델 로드 실패 — 기존 감지 방식으로 동작합니다.", e);
      availability = false;
      return null;
    }
  })();

  const session = await sessionPromise;
  // 실패한 프로미스를 남겨두면 재시도가 영원히 막히므로 초기화한다
  if (!session) sessionPromise = null;
  return session;
}

/** 현재 로드된 세션 설정 (없으면 null) */
export function getLoadedConfig(): ModelConfig | null {
  return loadedConfig;
}

/**
 * 캐시 초기화 — 관리자가 새 모델을 업로드했을 때 호출한다.
 * 다음 추론 시 모델을 다시 내려받는다. (onnxruntime 모듈 자체는 재사용)
 */
export function resetYoloModel() {
  const prev = sessionPromise;
  sessionPromise = null;
  loadedConfig = null;
  availability = null;
  availabilityPromise = null;
  prev?.then((s) => s?.release?.()).catch(() => {});
}
