/**
 * 프레임 사전 필터 — TensorFlow/YOLO 온디바이스 ML 연동 재발사항
 *
 * 현재는 'none' 모드만 구현되어 있으며 항상 pass: true 를 반환한다.
 * 추후 YOLO 모델 파일(.tflite 또는 ONNX)을 준비한 뒤
 * 'yolo' 모드 블록을 구현하면 OpenAI 호출 전 온디바이스 물체감지 필터를 적용할 수 있다.
 *
 * 활성화 방법: .env.local 에 NEXT_PUBLIC_FRAME_FILTER_MODE=yolo 추가
 */

export type FrameFilterMode = "none" | "yolo";

export interface FrameFilterResult {
  /** true 이면 OpenAI API 호출 진행, false 이면 이번 틱 건너뜀 */
  pass: boolean;
  /** YOLO 감지 시 물고기 존재 여부 (none 모드에서는 undefined) */
  hasFish?: boolean;
  /** YOLO 감지 시 기준물(볼) 존재 여부 (none 모드에서는 undefined) */
  hasBall?: boolean;
}

export type FrameFilter = (canvas: HTMLCanvasElement) => Promise<FrameFilterResult>;

/**
 * 프레임 필터 인스턴스를 생성한다.
 *
 * @param mode - "none": 항상 통과 (기본값) | "yolo": YOLO 온디바이스 감지 (추후 구현)
 * @returns 비동기 필터 함수
 */
export function createFrameFilter(mode: FrameFilterMode = "none"): FrameFilter {
  if (mode === "yolo") {
    // ── YOLO 모드 (추후 구현) ──────────────────────────────────────────────
    // TODO: 1. @tensorflow/tfjs 또는 onnxruntime-web 패키지 설치
    //       2. YOLO 모델 파일(.tflite / .onnx)을 /public/models/ 에 배치
    //       3. 아래 블록에 모델 로드 + 추론 로직 구현
    //
    // 예시 구조:
    //   const model = await tf.loadGraphModel('/models/yolo_fish.json');
    //   return async (canvas) => {
    //     const tensor = tf.browser.fromPixels(canvas);
    //     const result = await model.executeAsync(tensor);
    //     const { hasFish, hasBall } = parseYoloResult(result);
    //     return { pass: hasFish || hasBall, hasFish, hasBall };
    //   };
    //
    // 구현 전까지는 none 모드와 동일하게 동작한다.
    console.warn("[frameFilter] YOLO mode is not yet implemented. Falling back to 'none'.");
    return async () => ({ pass: true });
  }

  // ── none 모드 (기본값) — 항상 통과 ──────────────────────────────────────
  return async () => ({ pass: true });
}
