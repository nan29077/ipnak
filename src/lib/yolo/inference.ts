"use client";
/**
 * YOLO 추론 파이프라인 — 프레임 1장 → 감지 목록
 *
 *   preprocessFrame() → onnxruntime-web run() → postprocess()
 *
 * 설계 원칙 (기존 측정 흐름 보호):
 *  - 모델 파일이 없으면 `null` 을 반환한다. 예외를 던지지 않는다.
 *  - 호출부는 null 을 받으면 기존 색상/서버 AI 감지로 그대로 진행하면 된다.
 *  - 동시에 두 프레임을 추론하지 않는다 (busy 프레임은 즉시 null).
 */
import type { Detection, ModelConfig, SizeEstimate, YoloClassName, YoloResult } from "./types";
import { REFERENCE_CLASSES, REFERENCE_DIAMETER_MM } from "./types";
import { DEFAULT_MODEL_CONFIG, getOrt, isYoloModelAvailable, loadYoloModel } from "./modelLoader";
import { preprocessFrame } from "./preprocess";
import { postprocess } from "./postprocess";

let busy = false;

/** 지금 추론 중인지 (UI 스피너 등에 사용) */
export function isInferenceBusy() {
  return busy;
}

/**
 * 프레임 1장을 추론한다.
 *
 * @param src        캔버스 / 비디오 / 이미지 엘리먼트
 * @param overrides  모델 설정 일부 덮어쓰기
 * @returns          감지 결과. 모델 없음·로드 실패·중복 호출 시 null
 */
export async function runYoloInference(
  src: CanvasImageSource,
  overrides: Partial<ModelConfig> = {},
): Promise<YoloResult | null> {
  if (busy) return null;
  const config: ModelConfig = { ...DEFAULT_MODEL_CONFIG, ...overrides };

  // 모델이 없으면 무거운 import 자체를 하지 않는다
  if (!(await isYoloModelAvailable(config.modelUrl))) return null;

  const session = await loadYoloModel(config);
  if (!session) return null;

  const pre = preprocessFrame(src, config.inputSize);
  if (!pre) return null;

  busy = true;
  const started = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const ort = await getOrt(config);
    if (!ort) return null;
    const tensor = new ort.Tensor("float32", pre.data, pre.dims);
    const inputName = session.inputNames?.[0] ?? "images";
    const outputs = await session.run({ [inputName]: tensor });

    const outName = session.outputNames?.[0] ?? Object.keys(outputs)[0];
    const out = outputs[outName];
    if (!out?.data || !out?.dims) return null;

    const detections = postprocess(out.data as ArrayLike<number>, out.dims as number[], pre.info, {
      scoreThreshold: config.scoreThreshold,
      iouThreshold: config.iouThreshold,
      maxDetections: config.maxDetections,
      classNames: config.classNames,
    });

    return {
      detections,
      inferenceMs: (typeof performance !== "undefined" ? performance.now() : 0) - started,
      inputSize: config.inputSize,
      sourceWidth: pre.info.sourceWidth,
      sourceHeight: pre.info.sourceHeight,
    };
  } catch (e) {
    console.warn("[yolo] 추론 실패 — 기존 감지 방식으로 동작합니다.", e);
    return null;
  } finally {
    busy = false;
  }
}

/** 감지 목록에서 특정 클래스 중 최고 점수 1개 */
export function topByClass(dets: Detection[], className: YoloClassName): Detection | null {
  let best: Detection | null = null;
  for (const d of dets) {
    if (d.className !== className) continue;
    if (!best || d.score > best.score) best = d;
  }
  return best;
}

/** 감지 목록에서 기준물(입낚볼/입낚키링) 중 최고 점수 1개 */
export function topReference(dets: Detection[]): Detection | null {
  let best: Detection | null = null;
  for (const d of dets) {
    if (!d.className || !REFERENCE_CLASSES.includes(d.className)) continue;
    if (!best || d.score > best.score) best = d;
  }
  return best;
}

/**
 * 기준물 박스를 자로 삼아 물고기 크기를 추정한다.
 * 정밀 측정용이 아니라 **오버레이 미리보기용** 참고값이다 —
 * 실제 저장되는 계측값은 기존 /api/measure/scan 파이프라인이 계산한다.
 */
export function estimateSize(dets: Detection[]): SizeEstimate | null {
  const fish = topByClass(dets, "fish");
  const ref = topReference(dets);
  if (!fish || !ref || !ref.className) return null;
  // 기준물은 원/디스크라 가로·세로 평균을 지름으로 본다
  const diameterPx = (ref.box.w + ref.box.h) / 2;
  if (!(diameterPx > 0)) return null;
  const mmPerPixel = REFERENCE_DIAMETER_MM / diameterPx;
  return {
    lengthCm: Math.round((Math.max(fish.box.w, fish.box.h) * mmPerPixel) / 10 * 10) / 10,
    heightCm: Math.round((Math.min(fish.box.w, fish.box.h) * mmPerPixel) / 10 * 10) / 10,
    mmPerPixel,
    referenceClass: ref.className,
  };
}
