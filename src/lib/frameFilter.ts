/**
 * 프레임 사전 필터 — 온디바이스 YOLO 로 빈 프레임을 걸러 서버 AI 호출을 아낀다.
 *
 * - "none" (기본값): 항상 통과. 기존 동작과 완전히 동일하다.
 * - "yolo": public/models/best.onnx 가 있을 때만 동작. 물고기·기준물이 하나도
 *   안 잡힌 프레임은 서버 스캔을 건너뛴다. 모델이 없거나 추론이 실패하면
 *   자동으로 통과시켜 기존 흐름을 그대로 유지한다 (절대 막지 않는다).
 *
 * 활성화 방법: .env.local 에 NEXT_PUBLIC_FRAME_FILTER_MODE=yolo 추가
 */
import type { YoloResult } from "./yolo/types";
import { REFERENCE_CLASSES } from "./yolo/types";

export type FrameFilterMode = "none" | "yolo";

export interface FrameFilterResult {
  /** true 이면 서버 스캔 진행, false 이면 이번 틱 건너뜀 */
  pass: boolean;
  /** YOLO 감지 시 물고기 존재 여부 (none 모드에서는 undefined) */
  hasFish?: boolean;
  /** YOLO 감지 시 기준물(볼·키링) 존재 여부 (none 모드에서는 undefined) */
  hasBall?: boolean;
  /** YOLO 원본 결과 — 오버레이에 재사용하면 추론을 두 번 하지 않아도 된다 */
  yolo?: YoloResult | null;
}

export type FrameFilter = (canvas: HTMLCanvasElement) => Promise<FrameFilterResult>;

const PASS: FrameFilterResult = { pass: true };

/**
 * 프레임 필터 인스턴스를 생성한다.
 *
 * @param mode - "none": 항상 통과 (기본값) | "yolo": 온디바이스 YOLO 사전 감지
 */
export function createFrameFilter(mode: FrameFilterMode = "none"): FrameFilter {
  if (mode !== "yolo") {
    // ── none 모드 (기본값) — 항상 통과 ──
    return async () => PASS;
  }

  // ── YOLO 모드 ──
  // 모델 파일이 없으면 추론 자체가 null 을 돌려주므로 자동으로 none 과 같아진다.
  return async (canvas) => {
    try {
      const { runYoloInference } = await import("./yolo/inference");
      const result = await runYoloInference(canvas);
      if (!result) return PASS; // 모델 없음 / 추론 중 / 실패 → 기존 흐름 유지

      const hasFish = result.detections.some((d) => d.className === "fish");
      const hasBall = result.detections.some((d) => d.className && REFERENCE_CLASSES.includes(d.className));
      return { pass: hasFish || hasBall, hasFish, hasBall, yolo: result };
    } catch {
      return PASS;
    }
  };
}
