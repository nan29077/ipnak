"use client";
/**
 * YOLO 후처리 — 원시 출력 텐서 → 박스 파싱 + NMS + 클래스 매핑
 *
 * 지원 출력 포맷 (YOLOv8 `export format=onnx` 기본값):
 *   [1, 4 + nc, N]   — 채널 우선. 행 0~3 = cx,cy,w,h / 행 4.. = 클래스별 점수
 *   [1, N, 4 + nc]   — 박스 우선. 일부 변환 도구가 transpose 해서 내보낸다
 * 두 배치를 모두 자동 판별한다 (nc = classNames.length 기준).
 *
 * 좌표는 레터박스된 640×640 기준이므로 LetterboxInfo 로 원본 프레임 좌표로 되돌린다.
 */
import type { BoxPx, Detection, LetterboxInfo, YoloClassName } from "./types";
import { YOLO_CLASSES } from "./types";

/** IoU (Intersection over Union) */
export function iou(a: BoxPx, b: BoxPx): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = x2 - x1;
  const ih = y2 - y1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 클래스별 Non-Maximum Suppression.
 * 서로 다른 클래스끼리는 겹쳐도 억제하지 않는다 (물고기 위에 놓인 입낚볼이 지워지면 안 된다).
 */
export function nms(dets: Detection[], iouThreshold: number, maxDetections: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    if (kept.length >= maxDetections) break;
    let overlapped = false;
    for (const k of kept) {
      if (k.classId === d.classId && iou(k.box, d.box) > iouThreshold) {
        overlapped = true;
        break;
      }
    }
    if (!overlapped) kept.push(d);
  }
  return kept;
}

/** 출력 텐서 레이아웃 판별 결과 */
type Layout = { rows: number; cols: number; channelFirst: boolean };

/**
 * dims 와 클래스 수로 레이아웃을 판별한다.
 * @returns rows = 후보 박스 수, cols = 4 + nc
 */
function detectLayout(dims: readonly number[], attrs: number): Layout | null {
  // [1, A, B] 형태만 다룬다 (배치 1 고정)
  const d = dims.length === 3 ? dims.slice(1) : dims.length === 2 ? dims : null;
  if (!d) return null;
  const [a, b] = d;
  if (a === attrs) return { rows: b, cols: a, channelFirst: true };
  if (b === attrs) return { rows: a, cols: b, channelFirst: false };
  return null;
}

/** class id → 학습 클래스 이름. 모델이 더 많은 클래스를 가진 경우 null */
export function mapClassName(classId: number, classNames: readonly string[] = YOLO_CLASSES): YoloClassName | null {
  const name = classNames[classId];
  return (YOLO_CLASSES as readonly string[]).includes(name) ? (name as YoloClassName) : null;
}

export interface PostprocessOptions {
  scoreThreshold: number;
  iouThreshold: number;
  maxDetections: number;
  classNames: readonly string[];
}

/**
 * 원시 출력 → 최종 Detection 목록.
 *
 * @param raw   추론 출력 배열 (Float32Array 등)
 * @param dims  출력 텐서 shape
 * @param info  전처리 레터박스 정보 (좌표 복원용)
 */
export function postprocess(
  raw: ArrayLike<number>,
  dims: readonly number[],
  info: LetterboxInfo,
  opts: PostprocessOptions,
): Detection[] {
  const nc = opts.classNames.length;
  const attrs = 4 + nc;
  const layout = detectLayout(dims, attrs);
  if (!layout) {
    // 학습 클래스 수와 모델 출력이 맞지 않는다 — 잘못된 모델 파일
    console.warn("[yolo] 출력 텐서 형태를 해석할 수 없습니다.", dims, `expected 4+${nc}`);
    return [];
  }

  const { rows, cols, channelFirst } = layout;
  /** (박스 i, 속성 j) 값 읽기 */
  const at = channelFirst
    ? (i: number, j: number) => raw[j * rows + i]
    : (i: number, j: number) => raw[i * cols + j];

  const { scale, padX, padY, sourceWidth, sourceHeight } = info;
  const candidates: Detection[] = [];

  for (let i = 0; i < rows; i++) {
    // 최고 점수 클래스 선택
    let bestScore = 0;
    let bestId = -1;
    for (let c = 0; c < nc; c++) {
      const v = at(i, 4 + c);
      if (v > bestScore) {
        bestScore = v;
        bestId = c;
      }
    }
    if (bestId < 0 || bestScore < opts.scoreThreshold) continue;

    // 레터박스 좌표(cx,cy,w,h) → 원본 프레임 좌표(좌상단 x,y,w,h)
    const cx = at(i, 0);
    const cy = at(i, 1);
    const bw = at(i, 2);
    const bh = at(i, 3);
    const w = bw / scale;
    const h = bh / scale;
    const x = (cx - bw / 2 - padX) / scale;
    const y = (cy - bh / 2 - padY) / scale;

    // 프레임 밖으로 나간 부분은 잘라낸다
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(sourceWidth, x + w);
    const y1 = Math.min(sourceHeight, y + h);
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw <= 1 || ch <= 1) continue;

    const box: BoxPx = { x: x0, y: y0, w: cw, h: ch };
    candidates.push({
      classId: bestId,
      className: mapClassName(bestId, opts.classNames),
      score: bestScore,
      box,
      boxN: {
        x: box.x / sourceWidth,
        y: box.y / sourceHeight,
        w: box.w / sourceWidth,
        h: box.h / sourceHeight,
      },
    });
  }

  return nms(candidates, opts.iouThreshold, opts.maxDetections);
}
