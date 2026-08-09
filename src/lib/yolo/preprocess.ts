"use client";
/**
 * YOLO 전처리 — 캔버스/비디오 프레임 → Float32Array (NCHW, 640×640)
 *
 * YOLOv8 은 정사각 입력을 요구하지만 카메라 프레임은 16:9 다.
 * 그냥 늘려 넣으면 종횡비가 깨져 박스가 틀어지므로 **레터박스**(비율 유지 + 회색 여백)로 맞춘다.
 * 후처리에서 원본 좌표로 되돌릴 수 있도록 scale / padX / padY 를 함께 반환한다.
 *
 * ⚠️ onnxruntime-web 을 import 하지 않는다 — 순수 캔버스 연산이라 번들이 가볍다.
 */
import type { LetterboxInfo, PreprocessResult } from "./types";

/** 레터박스 여백 색 (YOLO 학습 시 관례값 114) */
const PAD_VALUE = 114;

/** 전처리 중간 캔버스 재사용 — 매 프레임 createElement 하면 GC 압력이 커진다 */
let scratch: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratch(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
  }
  if (!scratchCtx) return null;
  if (scratch.width !== size || scratch.height !== size) {
    scratch.width = size;
    scratch.height = size;
  }
  return { canvas: scratch, ctx: scratchCtx };
}

/** 전처리용 스크래치 캔버스 해제 (카메라 종료 시 호출 — 필수는 아님) */
export function releasePreprocessScratch() {
  scratch = null;
  scratchCtx = null;
}

/** 프레임 소스의 실제 픽셀 크기를 구한다 (video 는 videoWidth 를 써야 한다) */
export function sourceSize(src: CanvasImageSource): { width: number; height: number } {
  const anySrc = src as any;
  const width = anySrc.videoWidth || anySrc.naturalWidth || anySrc.width || 0;
  const height = anySrc.videoHeight || anySrc.naturalHeight || anySrc.height || 0;
  return { width: Number(width) || 0, height: Number(height) || 0 };
}

/**
 * 레터박스 파라미터만 계산한다 (실제 그리기 없이 좌표 변환이 필요할 때 사용).
 */
export function letterboxInfo(sourceWidth: number, sourceHeight: number, inputSize = 640): LetterboxInfo {
  const scale = Math.min(inputSize / sourceWidth, inputSize / sourceHeight);
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  return {
    scale,
    padX: (inputSize - drawW) / 2,
    padY: (inputSize - drawH) / 2,
    inputSize,
    sourceWidth,
    sourceHeight,
  };
}

/**
 * 캔버스/비디오/이미지 프레임을 YOLO 입력 텐서 데이터로 변환한다.
 *
 * @param src        HTMLCanvasElement | HTMLVideoElement | HTMLImageElement 등
 * @param inputSize  모델 입력 정사각 크기 (기본 640)
 * @returns          NCHW Float32Array + 좌표 복원 정보. 프레임이 비었으면 null
 */
export function preprocessFrame(src: CanvasImageSource, inputSize = 640): PreprocessResult | null {
  const { width: sw, height: sh } = sourceSize(src);
  if (!sw || !sh) return null;

  const s = getScratch(inputSize);
  if (!s) return null;
  const { ctx } = s;

  const info = letterboxInfo(sw, sh, inputSize);
  const drawW = sw * info.scale;
  const drawH = sh * info.scale;

  // 여백을 학습 때와 같은 회색으로 채운 뒤 비율 유지해 그린다
  ctx.fillStyle = `rgb(${PAD_VALUE},${PAD_VALUE},${PAD_VALUE})`;
  ctx.fillRect(0, 0, inputSize, inputSize);
  ctx.drawImage(src, 0, 0, sw, sh, info.padX, info.padY, drawW, drawH);

  const { data: rgba } = ctx.getImageData(0, 0, inputSize, inputSize);
  const area = inputSize * inputSize;
  const out = new Float32Array(area * 3);

  // RGBA(HWC, 0~255) → RGB(CHW, 0~1)
  for (let i = 0, p = 0; i < area; i++, p += 4) {
    out[i] = rgba[p] / 255;
    out[area + i] = rgba[p + 1] / 255;
    out[area * 2 + i] = rgba[p + 2] / 255;
  }

  return { data: out, dims: [1, 3, inputSize, inputSize], info };
}
