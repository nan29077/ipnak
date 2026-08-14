"use client";
/**
 * 실시간 AI 스캐너 (앱 내 카메라 스트림)
 * - getUserMedia 후면 카메라 라이브 프리뷰
 * - 2초마다 현재 프레임을 캡처 → base64 → /api/measure/scan 폴링
 * - 감지 성공(입낚볼 + 머리/꼬리 + pose=flat + 신뢰도 충분) 시:
 *     캔버스 오버레이(입낚볼 원 + 머리/꼬리 점 + 연결선) + 길이 미리보기 + "측정하기" 활성화
 * - "측정하기": 마지막 성공 프레임 + 감지 좌표를 부모로 넘겨 기존 결과 파이프라인 재사용
 * - 권한 거부 등 에러는 재시도 / 닫기로만 처리 (닫으면 측정 페이지 초기 화면)
 * - 세로/가로 방향 모두 풀스크린. 가로 모드는 우측 세로 사이드바로 UI 재배치
 *
 * ⚠️ 오버레이 정렬을 위해 video / overlay 모두 object-cover 사용 (동일 크롭 → 좌표 일치)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Camera, Loader2, RefreshCw, ScanLine, Check, RotateCw, AlertTriangle, Zap, ArrowRight } from "lucide-react";
import { estimateWeight, estimateWeightByWidth, formatWeight } from "@/lib/weightEstimation";
import { FISH_SPECIES } from "@/constants/errorMessages";
import { hasCameraConsent, setCameraConsent } from "./LiveMeasureCamera";
import { FishScanGlow } from "./FishScanGlow";
import { FishShimmer } from "./FishShimmer";
import { FishContourDetector, type ContourStatus } from "@/lib/fishContour";
import {
  AI_REFERENCE_RADIUS_MARGIN,
  isContourAlignedWithAxis,
  refineFishLandmarks,
  refineReferenceCircle,
} from "@/lib/measurementRefinement";
import {
  portraitToLandscapeTurn,
  rotateNormPoint,
  rotatePixelPoint,
  rotateWidthNormalizedRadius,
  type QuarterTurn,
} from "@/lib/cameraOrientation";
import { createFrameFilter } from "@/lib/frameFilter";
import type { FrameFilterMode } from "@/lib/frameFilter";
import { isYoloModelAvailable } from "@/lib/yolo/modelLoader";
import { estimateSize, runYoloInference } from "@/lib/yolo/inference";
import { YOLO_CLASS_COLOR, YOLO_CLASS_LABEL, type YoloResult } from "@/lib/yolo/types";

type Point = { x: number; y: number };
type Norm = { x: number; y: number };
type NormBall = { x: number; y: number; r: number };

/** measure 페이지 autoScan 성공 경로와 동일한 형태의 결과 */
export type LiveScanResult = {
  work: HTMLCanvasElement;
  ball: {
    found: true;
    centerX: number;
    centerY: number;
    diameterPx: number;
    /** 화면 표시(원 그리기) 전용 지름 — 정밀 측정 반지름 기준 (diameterPx 와 동일, 스케일 기준과 일치) */
    drawDiameterPx: number;
    mmPerPixel: number;
    confidence: number;
    method: "ai-scan";
  };
  head: Point;
  tail: Point;
  /** 몸통 최대 너비 양 끝점 — 감지 실패 시 null */
  width: { top: Point; bottom: Point } | null;
  confidence: number;
  /** 결과 패널에서 사용자가 선택한 어종 (미선택 시 "기타") */
  species: string;
};

type Props = {
  onConfirm: (result: LiveScanResult) => void; // "측정하기" — 결과 화면으로
  onClose: () => void;                          // X — 닫기
  /** 테스트 모드: 주황볼도 기준물로 허용. 프로덕션에서는 전달하지 않으면 false. */
  testBall?: boolean;
  /** 기준물 종류 — "keyring"(40mm 평면 디스크) / 기본 "ball"(40mm 구) */
  refType?: "ball" | "keyring";
};

/* ── 파티클 스파클 데이터 — x/y/size/duration/delay 완전히 독립적인 소수 기반 분산 ── */
const SPARKLES = Array.from({ length: 34 }, (_, i) => {
  // 각 축마다 서로 다른 큰 소수를 사용해 상관 패턴 제거
  const lx  = ((i * 7919  + 1337) % 10000) / 100;          // 0~100%
  const ly  = ((i * 6271  + 4177) % 9000)  / 100 + 5;      // 5~95%
  const sz  = ((i * 3917  +  777) % 42)    / 10  + 2;      // 2~6.1px
  const dur = ((i * 4657  +  999) % 22)    / 10  + 1.3;    // 1.3~3.5s
  const del = ((i * 5381  +  271) % 28)    / 10;           // 0~2.8s
  const colors = [
    "rgba(250,204,21,0.95)",   // 진한 노랑
    "rgba(255,255,255,0.9)",   // 흰색
    "rgba(234,179,8,0.8)",     // 골드
    "rgba(253,230,138,0.85)",  // 연한 노랑
    "rgba(255,255,255,0.65)",  // 반투명 흰
  ];
  // 애니메이션 종류도 고르게 분산
  const anims = ["sparkle", "sparkle", "sparkleFloat", "sparkle", "sparkleDrift"];
  return {
    left: `${lx.toFixed(1)}%`,
    top:  `${ly.toFixed(1)}%`,
    size: `${sz.toFixed(1)}px`,
    color: colors[i % colors.length],
    glow: sz > 4.5 ? 6 : sz > 3 ? 4 : 2,
    duration: dur.toFixed(2),
    delay: del.toFixed(2),
    anim: anims[i % anims.length],
  };
});

/** 기준물(입낚볼·입낚키링) 실측 "지름" — 반지름 아님.
 *  AI 의 ball.r 은 정규화 "반지름"(이미지 폭 기준)이므로
 *  픽셀 지름 = 2 × ball.r × imageWidth, mmPerPixel = 40 / 픽셀 지름.
 *  원 그리기 반지름 = ball.r × imageWidth (px) = 실측 20mm 에 해당. */
const REF_DIAMETER_MM = 40;

const POLL_INTERVAL_MS = 1500; // 스캔 폴링 주기
// idle 상태에서 연속으로 건너뛸 수 있는 최대 틱 수
// 이 횟수를 초과하면 idle이어도 강제 호출 (물고기를 놓치지 않기 위한 안전망)
const IDLE_SKIP_LIMIT = 3; // 3틱 = 4.5초
const SCAN_MAX_PX = 1280;      // 끝점·볼 외곽 정밀화를 위한 전송 프레임 최대 해상도
const REQ_TIMEOUT_MS = 9000;   // 개별 요청 하드 타임아웃
const CONFIDENCE_MIN = 0.7;    // 이 미만이면 실패 처리 (measure 페이지와 동일 기준)
const SHIMMER_MS = 1800;       // 윤슬(빛 포인트)이 물고기 외곽을 한 바퀴 도는 시간
// 이 신뢰도 이상이면 1회 성공만으로 즉시 윤슬 진행,
// 미만이면 연속 2회 성공해야 윤슬로 넘어간다 (오탐으로 인한 잘못된 자동 측정 방지)
const CONFIDENCE_INSTANT = 0.85;
const CONSECUTIVE_SUCCESS_NEEDED = 2;
// 원근 불일치(볼만 렌즈 앞으로 튀어나옴) 차단을 적용할 최소 신뢰도.
// 실시간 스캔은 매 1.5초마다 판정이 갱신되므로, 확신이 낮은 응답까지 차단에 쓰면
// 안내 문구가 깜빡이며 UX 가 나빠진다. 충분히 확신하는 응답에서만 게이트를 건다.
const PLANE_CHECK_MIN_CONFIDENCE = 0.75;
// 물고기는 인식됐는데 기준물만 연속으로 못 잡은 횟수 — 이 횟수를 넘으면 안내 후 카메라 종료
// (AI 응답 한 번의 실수로 카메라가 닫히지 않도록 2회 연속을 요구)
const REF_MISS_LIMIT = 2;
const FISH_MISS_LIMIT = 2; // 물고기 연속 미감지 횟수 (REF_MISS_LIMIT 와 동일, 빠른 반응)
// 물고기·기준물 모두 미감지 연속 횟수 — 둘 다 없는 상황 전용 팝업 트리거
const BOTH_MISS_LIMIT = 2;
// "판정 불가" 응답(타임아웃·AI 오류·레이트리밋·파싱 실패·no-ai-key 등)이 연속으로
// 이 횟수만큼 쌓이면 물고기 미감지와 동일하게 안내 팝업을 띄운다.
// (판정 불가만 계속 오면 fishMiss/refMiss 카운터가 영원히 안 올라 팝업이 절대 안 뜨는 것 방지)
const TOTAL_FAIL_LIMIT = FISH_MISS_LIMIT * 3; // 6회 연속 (약 12초+)

/* ── 결과 화면 레이아웃 상수 ──
   사진(물고기)이 정보/버튼에 가리지 않도록, 상·하단 오버레이 높이와 사진 영역의
   inset 을 같은 값으로 묶어 둔다 (한쪽만 바꾸면 사진이 패널 밑으로 들어간다).
   회전 무대에서는 LOCAL 방향과 기기 safe-area 축이 어긋나므로
   (LOCAL top = 기기 right / LOCAL bottom = 기기 left) 두 축을 max() 로 함께 잡는다. */
const RESULT_TOP_BAR_H = 52;
const RESULT_BOTTOM_PANEL_H = 118;
const SAFE_LOCAL_TOP = "max(0px, env(safe-area-inset-top, 0px), env(safe-area-inset-right, 0px))";
const SAFE_LOCAL_BOTTOM = "max(0px, env(safe-area-inset-bottom, 0px), env(safe-area-inset-left, 0px))";
const RESULT_TOP_INSET = `calc(${RESULT_TOP_BAR_H}px + ${SAFE_LOCAL_TOP})`;
const RESULT_BOTTOM_INSET = `calc(${RESULT_BOTTOM_PANEL_H}px + ${SAFE_LOCAL_BOTTOM})`;

/* ── 끝점 미세 조정용 돋보기(loupe) ──
   끝점을 길게 누르면 손가락에 가린 영역을 확대해 보여준다.
   배율은 "화면에 보이는 크기" 기준이다 (프레임 픽셀 기준이 아님) — 사용자가 체감하는
   확대율이 사진 표시 크기와 무관하게 일정해야 하기 때문이다. */
const LOUPE_LONG_PRESS_MS = 400;
const LOUPE_SIZE = 104;   // 지름 (CSS px)
const LOUPE_ZOOM = 2.6;
/** 돋보기가 손가락/끝점을 가리면 반대쪽으로 피할 때 쓰는 여유 */
const LOUPE_AVOID_MARGIN = 30;
const LOUPE_EDGE_GAP = 10;

type Cam = "loading" | "ready" | "error";

/**
 * 스캔 단계
 * - scan            : 물고기/기준물 탐색 중 (윤곽선은 그리지 않음)
 * - shimmer         : 물고기 + 기준물 모두 인식됨 → 윤슬 한 바퀴 후 자동 측정
 * - no-ref-warning  : 기준물 미감지 → "찾을 수 없습니다" 메시지 표시 (1.5초)
 * - ref-missing     : no-ref-warning 후 → "종료하시겠습니까?" 모달 표시
 * - no-fish-warning : 물고기 미감지 → "물고기를 찾을 수 없습니다" 메시지 표시 (1.5초)
 * - fish-missing    : no-fish-warning 후 → "종료하시겠습니까?" 모달 표시
 * - result          : 측정 확정 후 스캐너 화면 내 결과 패널 (캡처 프레임 고정 + 끝점 수정 + "다음" → onConfirm)
 */
type Stage = "scan" | "shimmer" | "no-ref-warning" | "ref-missing" | "no-fish-warning" | "fish-missing" | "no-both-warning" | "both-missing" | "result";

type Detection = {
  ballN: NormBall;
  /** AI 원본 정규화 반지름 (이미지 폭 기준) — 디버깅/비교용 보존.
      원 표시·측정 모두 ballN.r(노란 경계 실측값, 실패 시 AI 값과 동일)을 사용한다 */
  ballAiR: number;
  headN: Norm;
  tailN: Norm;
  widthN: { top: Norm; bottom: Norm } | null; // 몸통 최대 너비 (선택)
  /** 인식 완료 프레임의 물고기 외곽선. 결과 확인 화면에서만 표시한다. */
  contourN: Norm[] | null;
  confidence: number;
  lengthCm: number | null;
  widthCm: number | null;
};

type Landmarks = { head: Norm; tail: Norm; width: { top: Norm; bottom: Norm } | null };

/**
 * 물고기 외곽선 감지 (프레임 정규화 좌표).
 *
 * ① 전체 프레임에서 1회 감지 → ② 실패하면 AI 가 지목한 물고기 주변만 잘라 재감지한다.
 *    FishContourDetector 는 "테두리(배경) vs 중앙(피사체)" 색 우도비로 전경을 고르므로,
 *    바닥·장비가 복잡한 프레임에서는 물고기를 놓치거나 엉뚱한 영역을 잡는다.
 *    물고기 주변으로 잘라 주면 배경 표본이 정리되어 감지 성공률이 크게 올라간다.
 *
 * 어느 경우든 AI 의 머리→꼬리 축과 정합이 검증된 외곽선만 반환한다.
 * 검증에 실패하면 null 을 돌려 "엉뚱한 곳에 둘레선이 그려지는" 상황을 원천 차단한다.
 */
function detectFishContour(
  frame: HTMLCanvasElement,
  w: number,
  h: number,
  landmarks: Landmarks,
): Norm[] | null {
  const { head, tail } = landmarks;

  const attempt = (
    source: HTMLCanvasElement,
    sw: number,
    sh: number,
    toFrame: (p: Norm) => Norm,
  ): Norm[] | null => {
    const detector = new FishContourDetector();
    try {
      const res = detector.detect(source, sw, sh);
      if (res.status !== "locked" || res.points.length < 12) return null;
      const pts = res.points.map(toFrame);
      return isContourAlignedWithAxis(pts, w, h, head, tail) ? pts : null;
    } finally {
      detector.dispose();
    }
  };

  const full = attempt(frame, w, h, (p) => ({ x: p.x, y: p.y }));
  if (full) return full;

  // ── 물고기 주변 크롭 재시도 ──
  const xs = [head.x, tail.x];
  const ys = [head.y, tail.y];
  if (landmarks.width) {
    xs.push(landmarks.width.top.x, landmarks.width.bottom.x);
    ys.push(landmarks.width.top.y, landmarks.width.bottom.y);
  }
  const bw = (Math.max(...xs) - Math.min(...xs)) * w;
  const bh = (Math.max(...ys) - Math.min(...ys)) * h;
  // AI 가 머리·꼬리를 안쪽에 찍었을 수 있으므로(눈·꼬리자루) 실제 끝점까지 담기도록 넉넉히 확장한다
  const pad = Math.max(16, Math.max(bw, bh) * 0.22);
  const x0 = Math.max(0, Math.round(Math.min(...xs) * w - pad));
  const y0 = Math.max(0, Math.round(Math.min(...ys) * h - pad));
  const x1 = Math.min(w, Math.round(Math.max(...xs) * w + pad));
  const y1 = Math.min(h, Math.round(Math.max(...ys) * h + pad));
  const cw = x1 - x0;
  const ch = y1 - y0;
  // 너무 작거나 원본과 거의 같은 크롭은 재시도할 의미가 없다
  if (cw < 48 || ch < 48 || (cw >= w * 0.95 && ch >= h * 0.95)) return null;

  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  const ctx = crop.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(frame, x0, y0, cw, ch, 0, 0, cw, ch);
  return attempt(crop, cw, ch, (p) => ({ x: (x0 + p.x * cw) / w, y: (y0 + p.y * ch) / h }));
}

/** 각도를 (-180, 180] 로 정규화한다 (사진 표시 회전량 계산용) */
function normalizeDeg(deg: number) {
  return (((deg % 360) + 540) % 360) - 180;
}

/**
 * 포인터 이벤트를 대상 엘리먼트의 로컬 정규화 좌표(0~1)로 변환한다.
 *
 * 결과 패널의 사진 박스는 회전된 컨테이너 + 사진 자체 회전이 겹쳐 화면상 0/±90/180°
 * 어느 쪽으로도 놓일 수 있다. getBoundingClientRect() 는 "회전된 사각형의 AABB"를
 * 돌려주므로 (clientX - left) / width 공식이 그대로 성립하지 않는다.
 * 직각 회전이라 AABB 의 가로/세로가 로컬의 가로/세로 또는 그 반대와 같다는 성질을 이용해 역변환한다.
 *   rotate(90deg) : 로컬 변위 (dx,dy) → 화면 변위 (-dy,  dx)  ⇒  dx =  sy, dy = -sx
 *   rotate(-90deg): 로컬 변위 (dx,dy) → 화면 변위 ( dy, -dx)  ⇒  dx = -sy, dy =  sx
 *   rotate(180deg): 로컬 변위 (dx,dy) → 화면 변위 (-dx, -dy)  ⇒  dx = -sx, dy = -sy
 */
function pointerToLocalNorm(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  rotationDeg: number,
): { x: number; y: number; width: number; height: number } | null {
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const rot = normalizeDeg(rotationDeg);
  if (rot === 0) {
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
      width: rect.width,
      height: rect.height,
    };
  }
  const quarter = Math.abs(rot) === 90;
  const localW = quarter ? rect.height : rect.width;
  const localH = quarter ? rect.width : rect.height;
  const sx = clientX - (rect.left + rect.width / 2);
  const sy = clientY - (rect.top + rect.height / 2);
  const dx = rot === 90 ? sy : rot === -90 ? -sy : -sx;
  const dy = rot === 90 ? -sx : rot === -90 ? sx : -sy;
  return {
    x: (localW / 2 + dx) / localW,
    y: (localH / 2 + dy) / localH,
    width: localW,
    height: localH,
  };
}

function cloneDetection(d: Detection): Detection {
  return {
    ...d,
    ballN: { ...d.ballN },
    headN: { ...d.headN },
    tailN: { ...d.tailN },
    widthN: d.widthN ? { top: { ...d.widthN.top }, bottom: { ...d.widthN.bottom } } : null,
    contourN: d.contourN ? d.contourN.map((p) => ({ ...p })) : null,
  };
}

/**
 * 감지 결과(정규화 좌표)를 캔버스 픽셀 좌표로 변환해 그린다.
 * 라이브 오버레이(drawOverlay)와 결과 패널 오버레이가 공유한다.
 * 볼 원은 정밀 측정 반지름(ballN.r — 노란색 경계 방사형 스캔으로 실측한
 * 가장 바깥 테두리)을 사용해 실제 볼 외곽을 정확히 감싼다.
 * 이 값은 mmPerPixel 계산에 쓰는 반지름과 동일하므로, 화면의 원이 곧
 * 40mm 스케일 기준임이 시각적으로 일치한다 (실측 실패 시 AI 원본과 같음).
 * 결과 확인 화면에서도 같은 반지름을 사용해 40mm 기준 원과 계산 스케일을 일치시킨다.
 */
function drawDetection(
  ctx: CanvasRenderingContext2D,
  d: Detection,
  W: number,
  H: number,
) {
  const bx = d.ballN.x * W, by = d.ballN.y * H, br = d.ballN.r * W;
  const hx = d.headN.x * W, hy = d.headN.y * H;
  const tx = d.tailN.x * W, ty = d.tailN.y * H;
  const base = Math.max(W, H);

  // 머리-꼬리 연결선
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(34,197,94,0.9)";
  ctx.lineWidth = Math.max(3, base * 0.006);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // 입낚볼 원 (진한 노랑)
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = Math.max(3, br * 0.08);
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.stroke();

  // 머리(초록) / 꼬리(청록) 점
  const dot = (x: number, y: number, color: string) => {
    const r = Math.max(6, base * 0.016);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r + Math.max(2, r * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(hx, hy, "#22c55e");
  dot(tx, ty, "#22d3ee");

  // 몸통 최대 너비 선 (전장에 수직, 하늘색 점선)
  if (d.widthN) {
    const wtx = d.widthN.top.x * W, wty = d.widthN.top.y * H;
    const wbx = d.widthN.bottom.x * W, wby = d.widthN.bottom.y * H;
    ctx.setLineDash([Math.max(6, base * 0.012), Math.max(4, base * 0.008)]);
    ctx.strokeStyle = "rgba(125,211,252,0.95)";
    ctx.lineWidth = Math.max(2.5, base * 0.005);
    ctx.beginPath();
    ctx.moveTo(wtx, wty);
    ctx.lineTo(wbx, wby);
    ctx.stroke();
    ctx.setLineDash([]);
    // 폭 양 끝점 (하늘색 점 — 결과 패널에서 드래그 수정 대상)
    const wr = Math.max(5, base * 0.012);
    const wdot = (x: number, y: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, wr + Math.max(2, wr * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(x, y, wr, 0, Math.PI * 2);
      ctx.fill();
    };
    wdot(wtx, wty);
    wdot(wbx, wby);
  }
}

/**
 * 결과 확인 화면 전용 오버레이.
 * 물고기 위에는 외곽선·측정선·드래그 끝점만 표시한다. 길이·폭·예상 무게
 * 같은 수치는 사진 밖의 결과 패널에 표시해 피사체를 가리지 않는다.
 */
function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  d: Detection,
  W: number,
  H: number,
) {
  const base = Math.max(W, H);
  const lineW = Math.max(3, base * 0.005);
  const dotR = Math.max(7, base * 0.015);

  const hx = d.headN.x * W, hy = d.headN.y * H;
  const tx = d.tailN.x * W, ty = d.tailN.y * H;

  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 검증된 물고기 외곽을 첨부 시안처럼 하늘색으로 표시한다.
  if (d.contourN && d.contourN.length >= 3) {
    ctx.beginPath();
    d.contourN.forEach((p, index) => {
      const x = p.x * W, y = p.y * H;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(4, base * 0.0065);
    ctx.stroke();
    ctx.strokeStyle = "rgba(56,189,248,0.96)";
    ctx.lineWidth = Math.max(2, base * 0.0035);
    ctx.stroke();
  }

  /** 선 + 어두운 외곽선(밝은 사진 위에서도 보이도록) */
  const line = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = lineW + Math.max(2, base * 0.003);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  /** 드래그 가능한 끝점 (흰 테두리 + 컬러 안쪽) */
  const dot = (x: number, y: number, color: string) => {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, dotR + Math.max(3, dotR * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, dotR + Math.max(2, dotR * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── 전장(입↔꼬리) 선 ──
  line(hx, hy, tx, ty, "#22c55e");

  // ── 폭(세로) 선 ──
  if (d.widthN) {
    const wtx = d.widthN.top.x * W, wty = d.widthN.top.y * H;
    const wbx = d.widthN.bottom.x * W, wby = d.widthN.bottom.y * H;
    line(wtx, wty, wbx, wby, "#22d3ee");
    dot(wtx, wty, "#22d3ee");
    dot(wbx, wby, "#22d3ee");
  }

  // 전장 양 끝점 — 사용자가 입과 꼬리를 직접 미세 조정한다.
  dot(hx, hy, "#22c55e");
  dot(tx, ty, "#22c55e");

  // 기준물은 화면상의 검출 픽셀 지름을 실제 40mm로 환산하는 스케일이다.
  // 이 원은 확인/조정 화면에서만 보이고 다음 결과 화면에는 남기지 않는다.
  const bx = d.ballN.x * W, by = d.ballN.y * H, br = d.ballN.r * W;
  if (br > 0) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(4, base * 0.006);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(250,204,21,0.98)";
    ctx.lineWidth = Math.max(2, base * 0.0035);
    ctx.stroke();
  }
}

export function LiveScanCamera({ onConfirm, onClose, testBall = false, refType = "ball" }: Props) {
  const refLabel = refType === "keyring" ? "입낚키링" : "입낚볼";
  const videoRef = useRef<HTMLVideoElement>(null);
  // AI가 판정한 바로 그 프레임을 shimmer 동안 고정 표시한다.
  // 네트워크 응답 뒤 라이브 영상이 움직여 좌표와 피사체가 어긋나는 현상을 차단한다.
  const lockedFrameRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstScanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false); // 동시 요청 방지
  const abortRef = useRef<AbortController | null>(null);
  // 정밀 윤곽 요청 abort controller (스캔 성공마다 1회 발사, 다음 성공 시 이전 요청 취소)
  const aiOutlineAbortRef = useRef<AbortController | null>(null);
  // 스캔 성공 회차 ID — outline 응답이 돌아왔을 때 같은 회차인지 확인
  const scanIdRef = useRef(0);
  // 재촬영 직후 drawOverlay 가 이전 프레임으로 한 번 더 그리는 플래시 방지
  const isRetakingRef = useRef(false);
  // finalizeOrientation 이 적용한 90° 회전 방향 (portrait→landscape 변환) — outline 좌표 변환용
  const frameTurnRef = useRef<QuarterTurn | null>(null);
  // 마지막 성공 프레임 + 정규화 감지 좌표 (측정하기 확정용)
  const successRef = useRef<{ work: HTMLCanvasElement; det: Detection } | null>(null);
  const frameFilterRef = useRef(
    createFrameFilter((process.env.NEXT_PUBLIC_FRAME_FILTER_MODE as FrameFilterMode) || "none")
  );
  const idleSkipCountRef = useRef(0);

  const [camStatus, setCamStatus] = useState<Cam>("loading");
  const [camError, setCamError] = useState("");
  const [videoHasData, setVideoHasData] = useState(false);
  const [retry, setRetry] = useState(0);
  const [det, setDet] = useState<Detection | null>(null);
  // 실시간 물고기 윤곽 감지 상태 (FishScanGlow → 안내 문구 분기)
  const [scanStatus, setScanStatus] = useState<ContourStatus>("idle");
  const scanStatusRef = useRef<ContourStatus>("idle"); // 폴링 콜백에서 최신 상태 참조
  const [stage, setStage] = useState<Stage>("scan");
  const stageRef = useRef<Stage>("scan");
  const refMissRef = useRef(0);   // 기준물 연속 미감지 횟수 (물고기 O · 볼 X)
  const fishMissRef = useRef(0);  // 물고기 연속 미감지 횟수 (볼 O · 물고기 X)
  const bothMissRef = useRef(0);  // 둘 다 연속 미감지 횟수 (볼 X · 물고기 X)
  const totalFailRef = useRef(0); // "판정 불가" 응답(타임아웃·AI 오류 등) 연속 횟수
  const consecutiveSuccessRef = useRef(0); // 스캔 연속 성공 횟수 (낮은 신뢰도 확인용)
  // 키링이 너무 찌그러진 타원으로 잡힌 상태 (종횡비 미달) — 수직 촬영 안내 표시
  const [keyringTilted, setKeyringTilted] = useState(false);
  // 기준물과 물고기의 카메라 거리가 명백히 다른 상태 — 거리 맞추기 안내 표시
  const [planeMismatch, setPlaneMismatch] = useState(false);

  /* ── 결과 패널 (stage === "result") 전용 상태 ──
     캡처 프레임 고정 표시 캔버스 + 머리/꼬리/폭 끝점 드래그 수정.
     결과 패널은 회전된 UI 컨테이너 밖 fixed 오버레이(화면 좌표계)에 표시되며,
     이미지 영역은 프레임 비율을 유지한 contain 박스(fitBox)로 배치된다. */
  const frozenRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);            // 화면 여백을 채우는 블러 배경(같은 프레임)
  const resultOverlayRef = useRef<HTMLCanvasElement>(null); // 결과 패널 전용 측정 오버레이
  const resultAreaRef = useRef<HTMLDivElement>(null);       // 이미지 영역 (contain 계산 기준)
  // 이미지 영역 안에서 프레임 비율을 유지한 표시 박스 크기 (px)
  const [fitBox, setFitBox] = useState<{ w: number; h: number } | null>(null);
  /* finalizeOrientation 이 캡처 프레임 "픽셀"에 실제로 적용한 90° 회전 방향.
     null = 회전 없음(이미 가로 프레임).
     결과 패널의 사진 표시 회전량은 오직 이 값으로 결정한다 — 렌더 시점의 기기 방향
     상태로 다시 계산하면, 캡처 후 자동회전이 걸린 경우 회전이 180° 어긋나
     물고기가 뒤집혀 보인다 (문제 2의 원인). */
  const [frameTurn, setFrameTurn] = useState<QuarterTurn | null>(null);
  // finalizeOrientation 이 이미 방향을 확정한 캔버스 — 중복 호출 시 재회전·turn 초기화를 막는다
  const finalizedFrameRef = useRef<HTMLCanvasElement | null>(null);
  // 사진 박스가 화면상 최종적으로 몇 도 회전되어 있는지 — 포인터 좌표 역변환에 쓴다.
  const resultRotDegRef = useRef(0);
  const resultStageRef = useRef<HTMLDivElement>(null);      // 결과 화면 무대 (돋보기 배치 기준 좌표계)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const loupeBoxRef = useRef<HTMLDivElement>(null);
  const loupeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 롱프레스 타이머가 만료되는 시점의 "최신" 포인터 위치 (프레임 정규화 좌표)
  const loupePointRef = useRef<Norm | null>(null);
  // 표시 중인 돋보기 중심 — state 로 둬야 오버레이 갱신 뒤에 다시 그릴 수 있다
  const [loupePoint, setLoupePoint] = useState<Norm | null>(null);
  const dragKeyRef = useRef<"head" | "tail" | "widthTop" | "widthBottom" | null>(null);
  const initialDetectionRef = useRef<Detection | null>(null);
  const [activeDragKey, setActiveDragKey] = useState<typeof dragKeyRef.current>(null);
  // 결과 패널에서 사용자가 선택한 어종 — confirm 시 부모(측정 페이지)로 전달
  const [fishSpecies, setFishSpecies] = useState<string>("기타");
  // 플래시(토치) — 기기가 지원할 때만 사이드바에 버튼 노출
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  /* ── YOLO 온디바이스 감지 (public/models/best.onnx 가 있을 때만 동작) ──
     모델이 없으면 yoloOn 이 계속 false 라 아래 코드는 전부 건너뛰고
     기존(서버 AI + 색상 기반) 흐름만 그대로 돈다. */
  const yoloEnabledRef = useRef(false);          // 폴링 콜백에서 참조할 최신 활성 여부
  const yoloRef = useRef<YoloResult | null>(null); // 최근 감지 결과 (오버레이용)
  const [yoloTick, setYoloTick] = useState(0);   // 감지 갱신 → 오버레이 재렌더 트리거
  const yoloBusyRef = useRef(false);             // 프레임 중복 추론 방지

  /** FishScanGlow 감지 상태 수신 (state + ref 동시 갱신) */
  const handleScanStatus = useCallback((s: ContourStatus) => {
    scanStatusRef.current = s;
    setScanStatus(s);
  }, []);

  const goStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);
  // 브라우저 권한 요청 전 커스텀 안내 팝업 (LiveMeasureCamera 와 동일 UX)
  const [consented, setConsented] = useState(false);
  // 사용자가 선택한 촬영 방향 (false=세로, true=가로) — 기기 자동회전과 무관
  const [isLandscape, setIsLandscape] = useState(true); // 기본 가로 모드로 열림
  // 브라우저/기기가 실제로 가로 방향인지 (자동회전 ON 상태에서 폰을 돌렸을 때)
  const [browserIsLandscape, setBrowserIsLandscape] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  // confirm 시점에 최신 방향 값을 읽기 위한 ref (state 동기화)
  const isLandscapeRef = useRef(true);
  const browserIsLandscapeRef = useRef(
    typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );

  // effectiveLandscape: 실제로 가로 UI를 표시할지 여부
  const effectiveLandscape = isLandscape || browserIsLandscape;
  // needsCssRotation: CSS rotate(90deg) 트릭이 필요한 경우 (세로 고정 브라우저 + 가로 촬영)
  const needsCssRotation = effectiveLandscape && !browserIsLandscape;

  /* ── 결과 화면 표시 회전 계산 (물고기 뒤집힘 방지) ──
     불변식: finalizeOrientation 을 거친 캡처 프레임은 "픽셀 자체"가 이미 사용자에게
     보여줄 landscape 방향으로 확정되어 있다. 즉 결과 화면에서 사진을 CSS 로 다시
     돌릴 이유는, 무대(stage)가 rotate(90deg) 로 그려지는 경우를 상쇄할 때뿐이다.

     주의할 점은 finalizeOrientation 의 픽셀 회전이 서로 다른 두 목적으로 걸린다는 것이다.
       ① CSS 회전 트릭 촬영 (needsCssRotation=true, frameTurn="ccw")
          → 무대가 +90° 로 그려지므로 픽셀 CCW 회전은 그 무대 회전을 되돌리기 위한
            "보정분"이다. CSS 회전량 계산에 그대로 반영해야 한다.
       ② portrait → landscape 변환 (needsCssRotation=false, frameTurn="cw")
          → 세로로 찍은 프레임을 가로로 눕혀 확정한 것이라 캔버스가 이미 올바른
            landscape 다. 여기에 CSS 회전(-90°)까지 더 걸면 사진이 뒤집혀 보인다.
     따라서 CSS 보정량은 ① 에서만 픽셀 회전을 쓰고 ② 에서는 0 으로 둔다.

     결과적으로 세 케이스 모두 사진 CSS 회전은 0° 가 되고, 화면상 회전은 무대 회전과
     같아진다. 포인터 좌표 역변환(resultRotDegRef)이 이 값을 그대로 쓰므로 끝점
     히트 판정과 돋보기도 모든 끝점(머리/꼬리/폭)에서 정확히 맞는다.
       · 세로 고정 + 가로 촬영 : 픽셀 -90(ccw) · stage +90 · 보정 -90 → 사진 0° (기존 동작 유지)
       · 세로 촬영             : 픽셀 +90(cw)  · stage 0   · 보정 0   → 사진 0° (기존엔 -90° 로 뒤집히던 케이스)
       · 회전 불필요           : 픽셀 0        · stage 0   · 보정 0   → 사진 0° */
  const framePixelRotDeg = frameTurn === "ccw" ? -90 : frameTurn === "cw" ? 90 : 0;
  const resultStageRotDeg = needsCssRotation ? 90 : 0;
  /** 무대 회전을 상쇄하기 위한 픽셀 회전량 (portrait→landscape 변환분은 제외) */
  const cssCompensationRotDeg = needsCssRotation ? framePixelRotDeg : 0;
  /** 사진 박스가 화면상 최종적으로 회전된 각도 (= 무대 회전과 동일) */
  const resultPhotoScreenRotDeg = normalizeDeg(-cssCompensationRotDeg);
  /** 무대 안에서 사진 박스에 추가로 걸 CSS 회전량 */
  const resultPhotoRotDeg = normalizeDeg(-resultStageRotDeg - cssCompensationRotDeg);
  /** 사진이 ±90° 로 놓이면 표시 footprint 의 가로/세로가 뒤바뀐다 (contain 계산용) */
  const resultPhotoSwapsAxes = Math.abs(resultPhotoRotDeg) === 90;
  resultRotDegRef.current = resultPhotoScreenRotDeg;

  /* ── 스트림/폴링 정리 (재사용) ── */
  const cleanupStream = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
    abortRef.current?.abort();
    abortRef.current = null;
    aiOutlineAbortRef.current?.abort();
    aiOutlineAbortRef.current = null;
    isScanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ── 기기 방향 감지: 자동회전 ON 상태에서 가로/세로 전환 시 UI 자동 동기화 ── */
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => {
      setBrowserIsLandscape(e.matches);
      browserIsLandscapeRef.current = e.matches;
      // 기기 방향에 따라 UI 방향도 자동 맞춤
      setIsLandscape(e.matches);
      isLandscapeRef.current = e.matches;
    };
    mq.addEventListener("change", handler);
    // 초기 상태도 동기화
    browserIsLandscapeRef.current = mq.matches;
    if (mq.matches) { setIsLandscape(true); isLandscapeRef.current = true; }
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── YOLO 모델 배포 여부 확인 (요청 1회, 결과 캐싱) ──
     모델이 배포되어 있을 때만 온디바이스 감지를 켠다.
     없으면 onnxruntime 을 내려받지도 않고 기존 흐름만 그대로 돈다. */
  useEffect(() => {
    let cancelled = false;
    isYoloModelAvailable()
      .then((ok) => {
        if (cancelled || !ok) return;
        yoloEnabledRef.current = true;
      })
      .catch(() => { /* 확인 실패 = 모델 없음으로 간주 (기존 흐름 유지) */ });
    return () => { cancelled = true; };
  }, []);

  /* ── 프레임 1장 YOLO 추론 (실패해도 기존 흐름에 영향 없음) ──
     서버 스캔을 기다리게 하지 않으려고 await 하지 않고 백그라운드로 돌린다. */
  const runYolo = useCallback(async (frame: HTMLCanvasElement) => {
    if (!yoloEnabledRef.current || yoloBusyRef.current) return;
    yoloBusyRef.current = true;
    try {
      const result = await runYoloInference(frame);
      if (!result) return;
      yoloRef.current = result;
      setYoloTick((t) => t + 1);
    } catch {
      /* 추론 실패는 무시 — 서버 스캔 결과만으로 계속 진행한다 */
    } finally {
      yoloBusyRef.current = false;
    }
  }, []);

  /* ── 마운트 시 권한 상태 확인 → 이미 허용된 경우 커스텀 모달 스킵 ── */
  useEffect(() => {
    if (!hasCameraConsent()) return; // 동의 기록 없음 → 안내 모달 표시
    // localStorage에 동의 기록이 있으면 바로 스킵한다.
    // Safari는 navigator.permissions.query가 "granted" 대신 "prompt"를 반환해
    // 매번 모달이 재노출되는 문제가 있으므로 Permissions API 조회를 거치지 않는다.
    // 실제 카메라 접근이 거부된 경우엔 getUserMedia 오류 처리 쪽에서 안내한다.
    if (typeof navigator === "undefined") { setConsented(true); return; }
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((r) => {
          // "denied"인 경우에만 모달을 다시 표시, 나머지("granted"/"prompt")는 스킵
          if (r.state !== "denied") setConsented(true);
        })
        .catch(() => setConsented(true));
    } else {
      setConsented(true);
    }
  }, []);

  /* ── 카메라 시작 (LiveMeasureCamera 검증 로직 기반, iOS Safari 대응) ── */
  useEffect(() => {
    if (!consented) return; // 안내 팝업에서 '허용하기' 전에는 getUserMedia 호출 안 함
    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let hardId: ReturnType<typeof setTimeout> | null = null;
    setCamStatus("loading");
    setCamError("");
    setVideoHasData(false);

    const clearWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };
    const markReady = () => { if (!cancelled) { clearWatchdog(); setCamStatus("ready"); } };
    const markVideoData = () => { if (!cancelled) setVideoHasData(true); };
    const markError = (msg: string) => {
      if (cancelled) return;
      clearWatchdog();
      setCamError(msg);
      setCamStatus("error");
    };

    async function init() {
      if (typeof window === "undefined") return;
      if (!navigator.mediaDevices?.getUserMedia) {
        markError(
          window.isSecureContext
            ? "이 브라우저는 카메라를 지원하지 않아요.\n크롬/사파리 최신 버전으로 열어 주세요."
            : "HTTPS 환경에서만 카메라를 사용할 수 있습니다.\n주소가 https:// 로 시작하는지 확인해 주세요."
        );
        return;
      }

      // 권한 팝업 방치 등 무한 대기 대비 (10초 워치독)
      watchdog = setTimeout(() => {
        if (cancelled) return;
        if (streamRef.current) { markReady(); return; }
        markError("카메라 응답이 없어요.\n권한 요청 창이 떠 있다면 '허용'을 누른 뒤 재시도해 주세요.");
      }, 10000);

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastError: unknown = null;
      for (const c of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
        catch (e) { lastError = e; }
      }
      if (!stream) {
        const name = (lastError as DOMException)?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          markError("카메라 권한을 허용해주세요.\n브라우저 주소창 옆 자물쇠 아이콘을 눌러\n카메라를 허용한 뒤 재시도해 주세요.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          markError("카메라 기기를 찾을 수 없어요.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          markError("카메라가 다른 앱에서 사용 중이에요.\n다른 앱을 닫고 재시도해 주세요.");
        } else {
          markError("카메라를 시작할 수 없어요.\n권한 확인 후 재시도해 주세요.");
        }
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      const attach = () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (!v) { requestAnimationFrame(attach); return; }

        // iOS Safari: React가 muted를 DOM에 반영 못 하는 버그 → srcObject 전에 직접 지정
        v.muted = true;
        v.setAttribute("muted", "");
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.autoplay = true;

        const tryPlay = () => { v.play().catch(() => { /* autoplay policy */ }); };
        const start = () => { if (!cancelled) { tryPlay(); markReady(); } };

        v.onloadedmetadata = start;
        v.oncanplay = tryPlay;
        v.onplaying = () => { markReady(); markVideoData(); };
        v.onloadeddata = () => { if (v.videoWidth > 0) markVideoData(); };
        v.ontimeupdate = () => { if (!cancelled && v.videoWidth > 0) { markReady(); markVideoData(); } };

        v.srcObject = stream;
        const p0 = v.play();
        if (p0) p0.catch(() => {});

        // iOS autoplay 폴백: 재생 상태 확인 및 play() 재시도
        pollId = setInterval(() => {
          if (cancelled || !streamRef.current) { if (pollId) clearInterval(pollId); return; }
          if (v.paused) v.play().catch(() => {});
          if (v.readyState >= 2 && v.videoWidth > 0) {
            if (pollId) { clearInterval(pollId); pollId = null; }
            markReady();
            markVideoData();
          }
        }, 500);

        // 하드 폴백: 1.5초 후 강제 ready
        hardId = setTimeout(() => {
          if (pollId) { clearInterval(pollId); pollId = null; }
          if (!cancelled && streamRef.current) {
            v.play().catch(() => {});
            markReady();
            if (v.readyState >= 2 && v.videoWidth > 0) markVideoData();
          }
        }, 1500);

        if (v.readyState >= 1) start();
        if (v.readyState >= 2 && v.videoWidth > 0) markVideoData();
      };
      attach();
    }

    init().catch(() => markError("카메라를 시작할 수 없어요.\n권한 확인 후 재시도해 주세요."));

    return () => {
      cancelled = true;
      clearWatchdog();
      if (pollId) { clearInterval(pollId); pollId = null; }
      if (hardId) { clearTimeout(hardId); hardId = null; }
      const v = videoRef.current;
      if (v) {
        v.onloadedmetadata = null;
        v.oncanplay = null;
        v.onplaying = null;
        v.onloadeddata = null;
        v.ontimeupdate = null;
        v.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [retry, consented]);

  /* ── 언마운트 시 폴링/요청 정리 (스트림은 위 effect가 정리) ── */
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
      abortRef.current?.abort();
      aiOutlineAbortRef.current?.abort();
    };
  }, []);

  /* ── 플래시(토치) 지원 여부 확인 — 지원 기기에서만 사이드바 버튼 노출 ── */
  useEffect(() => {
    if (camStatus !== "ready") { setTorchSupported(false); setTorchOn(false); return; }
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    setTorchSupported(!!caps?.torch);
  }, [camStatus, retry]);

  /* ── 플래시(토치) 켜기/끄기 — 스트림 트랙 제약만 갱신 (스캔 로직 무관) ── */
  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    setTorchOn((prev) => {
      const next = !prev;
      track
        .applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] })
        .catch(() => { /* 미지원/거부 시 무시 */ });
      return next;
    });
  }, []);

  /* ── 오버레이 렌더 (감지 좌표 → 프리뷰 좌표) ── */
  const drawOverlay = useCallback((d: Detection | null) => {
    const ov = overlayRef.current;
    const v = videoRef.current;
    if (!ov) return;
    const locked = stage === "shimmer" ? successRef.current?.work : null;
    const W = locked?.width || v?.videoWidth || ov.width;
    const H = locked?.height || v?.videoHeight || ov.height;
    if (!W || !H) return;
    if (ov.width !== W) ov.width = W;
    if (ov.height !== H) ov.height = H;
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // 재촬영 직후 — 배치 커밋 전 구(舊) det 으로 한 프레임 더 그려지는 flash 방지
    if (isRetakingRef.current) return;

    /* ── 결과 화면에서는 라이브 오버레이에 아무것도 그리지 않는다 ──
       결과 화면의 det 는 finalizeOrientation 이 landscape 로 회전시킨 좌표라,
       회전 전 라이브 프레임 위에 그리면 엉뚱한 위치에 점·선이 남는다.
       (결과 진입·끝점 드래그 때마다 이 effect 가 돌므로, 여기서 그려 두면
        재촬영으로 스캔 화면에 복귀했을 때 이전 측정 오버레이 잔상의 원인이 된다) */
    if (stage === "result") return;

    /* ── YOLO 감지 박스 (모델이 배포된 경우에만) ──
       기존 오버레이보다 먼저 그려 아래 레이어로 깔린다.
       모델이 없으면 yoloRef 가 항상 null 이라 이 블록은 실행되지 않는다. */
    // 인식 확정 화면에서는 측정선만 남겨 결과를 깨끗하게 보여준다.
    const yolo = stage === "scan" && yoloEnabledRef.current ? yoloRef.current : null;
    if (yolo) {
      const yBase = Math.max(W, H);
      const fontPx = Math.max(13, Math.round(yBase * 0.022));
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(2, yBase * 0.004);
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
      ctx.textBaseline = "alphabetic";

      for (const det of yolo.detections) {
        if (!det.className) continue;
        const color = YOLO_CLASS_COLOR[det.className]; // 물고기=초록 / 기준물=노랑
        const x = det.boxN.x * W, y = det.boxN.y * H;
        const w = det.boxN.w * W, h = det.boxN.h * H;

        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);

        // 클래스 + 신뢰도 배지 (신뢰도 0.5 미만은 추론 단계에서 이미 걸러진다)
        const label = `${YOLO_CLASS_LABEL[det.className]} ${Math.round(det.score * 100)}%`;
        const tw = ctx.measureText(label).width;
        const bh = fontPx + 8;
        const by2 = y - bh < 0 ? y : y - bh;
        ctx.fillStyle = color;
        ctx.fillRect(x, by2, tw + 14, bh);
        ctx.fillStyle = "#111827";
        ctx.fillText(label, x + 7, by2 + bh - 6);
      }

      // 기준물(40mm) 대비 물고기 크기 자동 환산 — 참고용 미리보기
      const size = estimateSize(yolo.detections);
      if (size) {
        const text = `약 ${size.lengthCm}cm`;
        ctx.font = `700 ${Math.round(fontPx * 1.25)}px system-ui, sans-serif`;
        const tw = ctx.measureText(text).width;
        const pad = Math.round(fontPx * 0.6);
        const bh = Math.round(fontPx * 2);
        ctx.fillStyle = "rgba(17,24,39,0.72)";
        ctx.fillRect(pad, pad, tw + pad * 2, bh);
        ctx.fillStyle = "#4ade80";
        ctx.fillText(text, pad * 2, pad + bh - Math.round(fontPx * 0.66));
      }
    }

    if (!d) return;
    drawDetection(ctx, d, W, H);
  }, [stage]);

  // yoloTick 은 YOLO 감지가 갱신될 때마다 증가 — 모델이 없으면 영원히 0 이라 기존과 동일하다
  useEffect(() => { drawOverlay(det); }, [det, videoHasData, drawOverlay, yoloTick, stage]);

  /* 인식 확정 시 AI가 실제로 분석한 프레임을 고정한다.
     이후 shimmer·측정선·결과 전환이 모두 같은 픽셀을 기준으로 동작한다. */
  useEffect(() => {
    if (stage !== "shimmer") return;
    const source = successRef.current?.work;
    const canvas = lockedFrameRef.current;
    if (!source || !canvas) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
  }, [stage]);

  /* ── 프레임 캡처 → /api/measure/scan 폴링 ──
     stage 가 scan 일 때만 동작한다 (윤슬 진행 중/기준물 안내 중에는 정지) */
  useEffect(() => {
    if (camStatus !== "ready" || !videoHasData || (stage !== "scan")) return;
    let stopped = false;

    const runScan = async () => {
      if (stopped || isScanningRef.current) return;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      isScanningRef.current = true;
      try {
        const s = Math.min(1, SCAN_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
        const frame = document.createElement("canvas");
        frame.width = Math.max(1, Math.round(v.videoWidth * s));
        frame.height = Math.max(1, Math.round(v.videoHeight * s));
        const frameCtx = frame.getContext("2d", { willReadFrequently: true });
        if (!frameCtx) return;
        frameCtx.drawImage(v, 0, 0, frame.width, frame.height);
        const dataUrl = frame.toDataURL("image/jpeg", 0.88);

        // ── YOLO 온디바이스 감지 (모델이 배포된 경우에만) ──
        // 서버 스캔을 늦추지 않도록 await 하지 않고 백그라운드로 돌린다.
        // 결과는 오버레이 박스 표시에만 쓰이며, 측정값 계산에는 관여하지 않는다.
        void runYolo(frame);

        // 빈 프레임 차단: FishScanGlow 윤곽 감지 없으면 건너뜀 (API 비용 절감)
        // IDLE_SKIP_LIMIT 틱 초과 시 강제 호출 (물고기를 놓치지 않는 안전망)
        if (scanStatusRef.current === "idle") {
          idleSkipCountRef.current += 1;
          if (idleSkipCountRef.current < IDLE_SKIP_LIMIT) return;
        }
        idleSkipCountRef.current = 0;

        // 프레임 사전 필터 (현재 none 모드 — 항상 통과. YOLO 활성화 시 빈 프레임 차단)
        const filterResult = await frameFilterRef.current(frame);
        if (!filterResult.pass) return;

        const controller = new AbortController();
        abortRef.current = controller;
        const to = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
        let data: any = null;
        try {
          const res = await fetch("/api/measure/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl, width: frame.width, height: frame.height, testBall, refType }),
            signal: controller.signal,
          });
          if (res.ok) data = await res.json();
        } finally {
          clearTimeout(to);
          if (abortRef.current === controller) abortRef.current = null;
        }
        if (stopped) return;

        // 원근 안전장치 — 볼만 렌즈 앞으로 튀어나오면 mmPerPixel 이 과소 추정돼 길이가 과대 측정된다.
        // AI 가 명백히 거리가 다르다고 판정(false)했고, 그 판정의 신뢰도까지 충분할 때만 차단한다.
        // (필드가 없으면 null → 차단하지 않음. 키링 프롬프트는 이 필드를 요청하지 않는다.)
        const planeBlocked =
          data?.ok === true &&
          data.planeConsistent === false &&
          typeof data.confidence === "number" &&
          data.confidence >= PLANE_CHECK_MIN_CONFIDENCE;

        const ok =
          data?.ok &&
          data.ball && data.head && data.tail &&
          (data.pose === "flat" || data.pose === "held") &&
          typeof data.confidence === "number" &&
          data.confidence >= CONFIDENCE_MIN &&
          typeof data.ball.r === "number" && data.ball.r > 0 &&
          !planeBlocked;

        if (ok) {
          const w = frame.width, h = frame.height;
          // ── 노란 기준물의 중심 + 외곽을 함께 정밀 보정 ──
          // AI 좌표는 탐색 힌트로만 쓰고, 실제 노란 외곽점에 원을 피팅한다.
          // 원형도·각도 커버리지 검증 실패 시에는 AI 원본으로 안전하게 폴백한다.
          const aiRadiusPx = data.ball.r * w;
          // AI 는 볼 외곽이 아니라 내부 로고/하이라이트 경계를 잡아 반지름을 과소 추정한다.
          // 픽셀 정밀화가 성공하면 실측값을 쓰고, 실패하면 이 보정된 폴백을 쓴다.
          // (measure 페이지 autoScan 과 동일한 규칙 — 두 경로의 스케일을 일치시킨다)
          const fallbackRadiusPx = aiRadiusPx * AI_REFERENCE_RADIUS_MARGIN;
          let referenceGeometry = {
            centerX: data.ball.x * w,
            centerY: data.ball.y * h,
            radiusPx: fallbackRadiusPx,
            refined: false,
            confidence: 0,
            angularCoverage: 0,
          };
          try {
            const pixels = frameCtx.getImageData(0, 0, w, h);
            const refined = refineReferenceCircle(
              { data: pixels.data, width: w, height: h },
              // 탐색 기준은 항상 AI 원본 반지름 — 보정값을 넣으면 탐색 창이 통째로 밀린다
              { centerX: data.ball.x * w, centerY: data.ball.y * h, radiusPx: aiRadiusPx },
              testBall,
            );
            if (refined.refined) {
              referenceGeometry = refType === "keyring"
                // 키링은 약간의 원근 타원이 허용되므로 서버가 검증한 장축 반경을
                // 측정 스케일로 유지하되, 픽셀 분석으로 중심 위치만 바로잡는다.
                ? { ...refined, radiusPx: fallbackRadiusPx }
                : refined;
            }
          } catch { /* 픽셀 접근 실패 시 AI 원본 + 보정 유지 */ }
          const refinedRadiusPx = referenceGeometry.radiusPx;
          const diameterPx = 2 * refinedRadiusPx;
          const coarseWidth =
            data.width?.top && data.width?.bottom
              ? { top: data.width.top as Norm, bottom: data.width.bottom as Norm }
              : null;

          // ── 물고기 끝점을 실제 외곽으로 보수적으로 스냅 ──
          // 색상 기반 윤곽이 AI 축과 충분히 일치할 때만 적용한다. 복잡한 배경 등으로
          // 검증에 실패하면 서버의 기존 좌표를 그대로 사용한다.
          let landmarks: Landmarks = {
            head: { x: data.head.x, y: data.head.y },
            tail: { x: data.tail.x, y: data.tail.y },
            width: coarseWidth,
          };
          let contourN: Norm[] | null = null;
          try {
            // 전체 프레임 → 실패 시 물고기 주변 크롭으로 재시도.
            // AI 축과의 정합 검증을 통과한 윤곽만 돌아온다 (검증 실패 시 null → AI 좌표 유지).
            const contour = detectFishContour(frame, w, h, landmarks);
            if (contour) {
              contourN = contour;
              const refined = refineFishLandmarks(contour, w, h, landmarks);
              landmarks = { head: refined.head, tail: refined.tail, width: refined.width };
            }
          } catch { /* 윤곽 보정 실패 시 AI 좌표 유지 */ }

          let lengthCm: number | null = null;
          let widthCm: number | null = null;
          if (diameterPx > 0) {
            const mmPerPixel = REF_DIAMETER_MM / diameterPx; // 지름 40mm 기준
            const hx = landmarks.head.x * w, hy = landmarks.head.y * h;
            const tx = landmarks.tail.x * w, ty = landmarks.tail.y * h;
            const px = Math.hypot(tx - hx, ty - hy);
            lengthCm = Math.round((px * mmPerPixel) / 10 * 10) / 10; // cm, 소수 1자리
            if (landmarks.width) {
              const wpx = Math.hypot(
                (landmarks.width.bottom.x - landmarks.width.top.x) * w,
                (landmarks.width.bottom.y - landmarks.width.top.y) * h,
              );
              widthCm = wpx > 0 ? Math.round((wpx * mmPerPixel) / 10 * 10) / 10 : null;
            }
          }
          const detection: Detection = {
            ballN: { x: referenceGeometry.centerX / w, y: referenceGeometry.centerY / h, r: refinedRadiusPx / w },
            ballAiR: data.ball.r,
            headN: landmarks.head,
            tailN: landmarks.tail,
            widthN: landmarks.width,
            contourN,
            confidence: data.confidence,
            lengthCm,
            widthCm,
          };
          successRef.current = { work: frame, det: detection };
          refMissRef.current = 0;
          fishMissRef.current = 0;
          bothMissRef.current = 0;
          totalFailRef.current = 0;
          setKeyringTilted(false);
          setPlaneMismatch(false);
          setDet(detection);
          // 물고기 + 기준물 모두 인식 → 윤슬 한 바퀴 후 자동 측정.
          // 다만 신뢰도가 낮으면(< CONFIDENCE_INSTANT) 한 번 더 같은 결과가 나올 때까지
          // 확인한 뒤 진행한다 (단발 오탐으로 잘못 측정되는 것 방지).
          consecutiveSuccessRef.current += 1;
          if (
            detection.confidence >= CONFIDENCE_INSTANT ||
            consecutiveSuccessRef.current >= CONSECUTIVE_SUCCESS_NEEDED
          ) {
            consecutiveSuccessRef.current = 0;
            goStage("shimmer");

            // ── AI 정밀 윤곽 요청 (shimmer 1.8초 동안 백그라운드 실행) ──
            // gpt-4o-mini 로 물고기 외곽선 폴리곤(20~24점)을 추출한다.
            // 응답이 shimmer 중에 오면 result 화면 진입 전에 contourN 이 교체되고,
            // result 화면 진입 후에 오면 det 상태 갱신으로 오버레이가 자동 리드로된다.
            // 실패·타임아웃 시엔 기존 FishContourDetector 윤곽을 그대로 사용한다.
            aiOutlineAbortRef.current?.abort();
            const outlineCtrl = new AbortController();
            aiOutlineAbortRef.current = outlineCtrl;
            scanIdRef.current += 1;
            const currentScanId = scanIdRef.current;
            const capturedDataUrl = dataUrl;
            const capturedFrame = frame;
            void (async () => {
              try {
                const r = await fetch("/api/measure/outline", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ imageBase64: capturedDataUrl }),
                  signal: outlineCtrl.signal,
                });
                if (!r.ok) return;
                const od = await r.json();
                if (!od?.ok || !Array.isArray(od.contour) || od.contour.length < 8) return;
                // 다른 스캔 회차로 교체됐다면 무시
                if (scanIdRef.current !== currentScanId) return;
                // finalizeOrientation 이 portrait→landscape 회전을 적용했다면 좌표 변환
                const turn = frameTurnRef.current;
                const rawContour: Array<{ x: number; y: number }> = od.contour;
                const outlineContour = turn
                  ? rawContour.map((p) => rotateNormPoint(p, turn))
                  : rawContour;
                const s = successRef.current;
                if (!s) return;
                const updated: Detection = { ...s.det, contourN: outlineContour };
                successRef.current = { work: s.work, det: updated };
                setDet((prev) => prev ? { ...prev, contourN: outlineContour } : prev);
              } catch {
                // 실패 시 기존 FishContourDetector 윤곽 유지 (사용자에게 영향 없음)
              } finally {
                if (aiOutlineAbortRef.current === outlineCtrl) aiOutlineAbortRef.current = null;
              }
            })();
          }
        } else {
          // 실패/인식 안 됨 → 오버레이 제거 (스펙: 카메라 화면만 유지)
          successRef.current = null;
          setDet(null);
          consecutiveSuccessRef.current = 0; // 연속 성공 카운터 리셋
          // 키링이 너무 찌그러진 타원(종횡비 미달) — 기준물·물고기는 보이므로 미감지 카운터는 리셋하고
          // 수직 촬영 안내만 띄운다.
          const tilted = data?.ok === false && data?.reason === "keyring-tilted";
          setKeyringTilted(tilted);
          // 원근 불일치는 기준물·물고기가 모두 보이는 상태이므로 미감지 카운터는 건드리지 않고
          // (아래 data.ok === true 분기에서 리셋된다) 거리 맞추기 안내만 띄운다.
          setPlaneMismatch(planeBlocked);
          if (tilted) {
            totalFailRef.current = 0;
            refMissRef.current = 0;
            fishMissRef.current = 0;
            bothMissRef.current = 0;
          } else if (data?.ok === false && data?.reason === "no-ball") {
            totalFailRef.current = 0; // 확정 판정 수신 → 판정 불가 연속 카운터 리셋
            // 기준물(입낚볼·입낚키링) 미감지 —
            // API 가 fishFound:false 이고 ballFound:false ("아무것도 없음") 인 경우:
            //   → 클라이언트 윤곽 감지(scanStatus "locked") 를 무시하고 둘 다 없음으로 처리.
            //     (윤곽 감지는 사람 다리/의류 등을 물고기로 오인식할 수 있음)
            // API 가 fishFound:true 이거나 윤곽 감지가 locked 인 경우만 "물고기는 있음"으로 판단.
            const bothAbsent = data?.ballFound === false && data?.fishFound === false;
            const fishVisible =
              data?.fishFound === true ||
              (!bothAbsent && scanStatusRef.current === "locked");
            if (fishVisible) {
              // 물고기 O · 볼 X → 기준물 미감지 카운터
              fishMissRef.current = 0;
              bothMissRef.current = 0;
              refMissRef.current += 1;
              if (refMissRef.current >= REF_MISS_LIMIT) goStage("no-ref-warning");
            } else if (bothAbsent) {
              // 물고기 X · 볼 X → 둘 다 미감지 카운터 (별도 팝업)
              refMissRef.current = 0;
              fishMissRef.current = 0;
              bothMissRef.current += 1;
              if (bothMissRef.current >= BOTH_MISS_LIMIT) goStage("no-both-warning");
            } else {
              // 물고기 X (볼도 없으나 bothAbsent 아닌 경우) → 물고기 미감지
              refMissRef.current = 0;
              bothMissRef.current = 0;
              fishMissRef.current += 1;
              if (fishMissRef.current >= FISH_MISS_LIMIT) goStage("no-fish-warning");
            }
          } else if (data?.ok === false && data?.reason === "no-fish") {
            // 볼 O · 물고기 X → 물고기 미감지 카운터
            totalFailRef.current = 0; // 확정 판정 수신 → 판정 불가 연속 카운터 리셋
            refMissRef.current = 0;
            bothMissRef.current = 0;
            fishMissRef.current += 1;
            if (fishMissRef.current >= FISH_MISS_LIMIT) goStage("no-fish-warning");
          } else if (data && (data.ok === true || data.ballFound === true)) {
            // 기준물이 실제로 화면에 잡힌 확정 응답 → 두 카운터 모두 리셋
            totalFailRef.current = 0;
            refMissRef.current = 0;
            fishMissRef.current = 0;
          } else {
            // 그 외(429 레이트리밋, 타임아웃, AI 오류, 파싱 실패, no-ai-key 등 판정 불가 응답)
            // — 기존 fishMiss/refMiss 카운터는 유지하되, 판정 불가가 연속으로 계속 쌓이면
            //   팝업이 영원히 안 뜨므로 별도 연속 실패 카운터로 물고기 미감지 안내를 띄운다
            totalFailRef.current += 1;
            if (totalFailRef.current >= TOTAL_FAIL_LIMIT) goStage("no-fish-warning");
          }
        }
      } catch {
        if (!stopped) {
          successRef.current = null;
          setDet(null);
          setPlaneMismatch(false); // 판정 불가 응답에서는 거리 안내를 남겨두지 않는다
          consecutiveSuccessRef.current = 0; // 연속 성공 카운터 리셋
          // 클라이언트 요청 타임아웃(9초 abort)·네트워크 오류도 "판정 불가"로 집계
          totalFailRef.current += 1;
          if (totalFailRef.current >= TOTAL_FAIL_LIMIT) goStage("no-fish-warning");
        }
      } finally {
        isScanningRef.current = false;
      }
    };

    firstScanRef.current = setTimeout(runScan, 700); // 첫 스캔은 조금 빨리
    pollRef.current = setInterval(runScan, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
      abortRef.current?.abort();
    };
    // refType·testBall 은 스캔 요청 본문과 반경 보정에 그대로 쓰인다.
    // 의존성에서 빠져 있으면 stale closure 로 이전 모드 값이 계속 전송된다 (예: 키링 모드인데 볼 기준으로 판정).
  }, [camStatus, videoHasData, stage, goStage, runYolo, refType, testBall]);

  /* ── "측정하기": 마지막 성공 프레임 확정 → 부모로 ──
     정상 흐름에서는 결과 패널 진입 시 finalizeOrientation() 이 이미 프레임을
     landscape 로 확정했으므로 아래 needsRotate 는 false 가 되어 그대로 통과한다.
     (회전 로직은 결과 패널을 거치지 않는 예외 경로 대비 안전망으로 유지) */
  const confirm = useCallback(() => {
    const s = successRef.current;
    if (!s) return;
    cleanupStream();

    const srcW = s.work.width, srcH = s.work.height;
    // 캡처 프레임이 세로(portrait)인 경우 → 부모(측정 페이지)에서도 항상 가로로
    // 보이도록 실제 픽셀을 90° 회전한다 (finalizeOrientation 과 동일 기준·동일 방향).
    const needsRotate = srcW < srcH;
    const turn = portraitToLandscapeTurn(isLandscapeRef.current, browserIsLandscapeRef.current);

    // diameterPx는 항상 원본 portrait width 기준 (ballN.r는 portrait width로 정규화됨)
    const diameterPx = 2 * s.det.ballN.r * srcW;
    if (!(diameterPx > 0)) { onClose(); return; }

    let workCanvas = s.work;
    let ballCX = s.det.ballN.x * srcW;
    let ballCY = s.det.ballN.y * srcH;
    let headPt = { x: s.det.headN.x * srcW, y: s.det.headN.y * srcH };
    let tailPt = { x: s.det.tailN.x * srcW, y: s.det.tailN.y * srcH };
    let widthResult: { top: { x: number; y: number }; bottom: { x: number; y: number } } | null = s.det.widthN
      ? {
          top: { x: s.det.widthN.top.x * srcW, y: s.det.widthN.top.y * srcH },
          bottom: { x: s.det.widthN.bottom.x * srcW, y: s.det.widthN.bottom.y * srcH },
        }
      : null;

    if (needsRotate) {
      // 90° 회전: portrait(srcW×srcH) → landscape(srcH×srcW)
      const dst = document.createElement("canvas");
      dst.width = srcH;
      dst.height = srcW;
      const ctx = dst.getContext("2d")!;
      if (turn === "ccw") {
        ctx.translate(0, dst.height);
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.translate(dst.width, 0);
        ctx.rotate(Math.PI / 2);
      }
      ctx.drawImage(s.work, 0, 0, srcW, srcH);
      workCanvas = dst;

      // 좌표 변환: CCW (px,py) → (py, srcW - px) / CW (px,py) → (srcH - py, px)
      const tf = (p: { x: number; y: number }) => rotatePixelPoint(p, srcW, srcH, turn);
      const rotatedBall = tf({ x: ballCX, y: ballCY });
      ballCX = rotatedBall.x;
      ballCY = rotatedBall.y;
      headPt = tf(headPt);
      tailPt = tf(tailPt);
      widthResult = widthResult
        ? { top: tf(widthResult.top), bottom: tf(widthResult.bottom) }
        : null;
    }

    const result: LiveScanResult = {
      work: workCanvas,
      ball: {
        found: true,
        centerX: ballCX,
        centerY: ballCY,
        diameterPx,
        // 표시용 지름도 정밀 측정 반지름 기준 — 결과 패널의 원과 측정 페이지의 원이 동일하게
        // 실제 볼 외곽을 감싸고, mmPerPixel 스케일 기준과도 일치한다
        drawDiameterPx: diameterPx,
        mmPerPixel: REF_DIAMETER_MM / diameterPx,
        confidence: s.det.confidence,
        method: "ai-scan",
      },
      head: headPt,
      tail: tailPt,
      width: widthResult,
      confidence: s.det.confidence,
      species: fishSpecies,
    };
    onConfirm(result);
  }, [cleanupStream, onConfirm, onClose, fishSpecies]);

  /* ── 결과 패널 진입 직전: 프레임 방향 확정 ──
     CSS rotate(90deg) 트릭으로 촬영한 경우 캡처 프레임은 portrait(srcW < srcH)다.
     결과 패널은 사용자가 본 방향(landscape)으로 보여야 하므로, 진입 시점에
     실제 픽셀을 90°CW 회전하고 감지 좌표도 함께 변환해 successRef 를 교체한다.
     이후 표시(고정 캔버스·오버레이) · 끝점 드래그 수정 · confirm 전달까지
     전부 이 landscape 좌표계 하나로 통일된다 (표시/전달 좌표 불일치 원천 차단).
     - 픽셀:   portrait (px, py) → landscape (srcH - py, px)
     - 정규화: (nx, ny) → (1 - ny, nx)
     - 반지름: 픽셀 반지름 r*srcW 는 회전 불변 → landscape 폭(srcH) 기준
               정규화로 환산 (× srcW/srcH). 따라서 landscape 캔버스에서
               ballAiR_land * W_land = ball.r * srcW 픽셀로 실제 볼 크기와 일치한다.
     네이티브 가로(이미 landscape 프레임)·세로 모드에서는 아무것도 하지 않는다.

     ⚠️ 회전 "방향"이 핵심이다.
     CSS 회전 트릭(needsCssRotation)으로 촬영하는 동안 UI 는 rotate(90deg)(시계 방향)로
     그려지므로, 사용자는 그 화면을 바로 보기 위해 기기를 반시계 방향으로 눕혀 잡는다.
     즉 캡처 프레임(기기 좌표계)은 실제 장면이 시계 방향으로 90° 돌아간 상태다.
     이를 되돌리려면 반시계(CCW)로 회전해야 한다 — 시계 방향으로 돌리면 180° 어긋나
     물고기가 상하로 뒤집힌 사진이 된다(측정 페이지 상단 이미지 뒤집힘 원인).
       CCW: 픽셀 (px,py) → (py, srcW - px) / 정규화 (nx,ny) → (ny, 1 - nx)
       CW : 픽셀 (px,py) → (srcH - py, px) / 정규화 (nx,ny) → (1 - ny, nx)
     세로 모드 촬영(기기를 세워서 촬영)은 위/아래 기준이 따로 없으므로 기존 CW 유지. */
  const finalizeOrientation = useCallback(() => {
    const s = successRef.current;
    if (!s) return;
    // 이미 이 프레임에 방향을 확정했다면 아무것도 하지 않는다.
    // (중복 호출 시 회전 완료된 가로 프레임을 "회전 없음"으로 재기록해 표시 방향이 어긋나는 것 방지)
    if (finalizedFrameRef.current === s.work) return;
    const srcW = s.work.width, srcH = s.work.height;
    // 어떤 방향으로 촬영했든 최종 프레임은 항상 landscape(가로) —
    // 캡처 프레임이 portrait 이면 UI 모드와 무관하게 90° 회전해 확정한다.
    // (세로 모드 촬영도 결과·계측일지에서는 가로로 눕혀 보여준다)
    const needsRotate = srcW < srcH;
    if (!needsRotate) { finalizedFrameRef.current = s.work; setFrameTurn(null); return; }
    // CSS 회전 트릭으로 가로 촬영한 경우에만 반시계 방향으로 되돌린다
    const turn = portraitToLandscapeTurn(isLandscapeRef.current, browserIsLandscapeRef.current);

    // 90° 회전: portrait(srcW×srcH) → landscape(srcH×srcW)
    const dst = document.createElement("canvas");
    dst.width = srcH;
    dst.height = srcW;
    const ctx = dst.getContext("2d");
    if (!ctx) { setFrameTurn(null); return; }
    if (turn === "ccw") {
      ctx.translate(0, dst.height);
      ctx.rotate(-Math.PI / 2);
    } else {
      ctx.translate(dst.width, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.drawImage(s.work, 0, 0, srcW, srcH);

    const tf = (p: Norm): Norm => rotateNormPoint(p, turn);
    const rotatedRadius = (r: number) => rotateWidthNormalizedRadius(r, srcW, srcH);
    const d = s.det;
    const rotated: Detection = {
      ...d,
      ballN: { ...tf(d.ballN), r: rotatedRadius(d.ballN.r) },
      ballAiR: rotatedRadius(d.ballAiR),
      headN: tf(d.headN),
      tailN: tf(d.tailN),
      widthN: d.widthN ? { top: tf(d.widthN.top), bottom: tf(d.widthN.bottom) } : null,
      contourN: d.contourN ? d.contourN.map(tf) : null,
      // lengthCm/widthCm 은 회전 불변 (정규화 dx*W, dy*H 가 축만 맞바뀜) — 재계산 불필요
    };
    successRef.current = { work: dst, det: rotated };
    finalizedFrameRef.current = dst;
    // 표시 회전량의 유일한 기준 — 이후 기기 방향이 바뀌어도 사진은 정방향을 유지한다
    setFrameTurn(turn);
    frameTurnRef.current = turn; // outline 좌표 변환용 ref 동기화
    setDet(rotated);
  }, []);

  /* ── 결과 패널 열기: 프레임 방향 확정 후 result 단계로 전환 ── */
  const openResult = useCallback(() => {
    // 윤슬 완료와 "측정하기" 탭이 겹쳐 두 번 호출되면 조정 기준(initialDetection)이
    // 사용자가 이미 수정한 좌표로 덮어써진다 — 이미 결과 화면이면 무시한다.
    if (stageRef.current === "result") return;
    finalizeOrientation();
    const current = successRef.current;
    initialDetectionRef.current = current ? cloneDetection(current.det) : null;
    goStage("result");
  }, [finalizeOrientation, goStage]);

  /* ── 윤슬 한 바퀴 완료 → 스캐너 화면 내 결과 패널 표시 ("다음"에서 confirm) ── */
  const handleShimmerComplete = useCallback(() => {
    if (successRef.current) openResult();
    else goStage("scan");
  }, [openResult, goStage]);

  /* ── 결과 패널 이미지 영역: 프레임 비율을 유지한 contain 박스 크기 계산 ──
     박스 크기 = 프레임 표시 크기이므로, 드래그 수정 레이어의 로컬 정규화 좌표가
     그대로 프레임 정규화 좌표와 일치한다 (기존 드래그 로직 무변경).
     사진이 ±90° 로 놓이는 경우에는 화면을 차지하는 footprint 의 가로/세로가 뒤바뀌므로
     그 상태로 contain 을 계산해야 사진이 영역 밖으로 삐져나가지 않는다. */
  useEffect(() => {
    if (stage !== "result") { setFitBox(null); return; }
    const area = resultAreaRef.current;
    const s = successRef.current;
    if (!area || !s) return;
    const compute = () => {
      const aw = area.clientWidth, ah = area.clientHeight;
      const fw = s.work.width, fh = s.work.height;
      if (!aw || !ah || !fw || !fh) return;
      const dispW = resultPhotoSwapsAxes ? fh : fw;
      const dispH = resultPhotoSwapsAxes ? fw : fh;
      const k = Math.min(aw / dispW, ah / dispH);
      setFitBox({ w: fw * k, h: fh * k });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(area);
    return () => ro.disconnect();
  }, [stage, resultPhotoSwapsAxes]);

  // 결과 화면 뒤의 측정 페이지가 스크롤되거나 스크롤바가 비쳐 보이지 않게 잠근다.
  useEffect(() => {
    if (stage !== "result") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [stage]);

  /* ── 결과 패널 진입 시 캡처 프레임을 고정 표시 캔버스에 그린다 ──
     배경 캔버스(bgRef)에도 같은 프레임을 그려 cover + 블러로 화면 여백을 채운다.
     (fitBox 확정 후 캔버스가 마운트되므로 fitBox 를 deps 에 포함) */
  useEffect(() => {
    if (stage !== "result") return;
    const s = successRef.current;
    const cv = frozenRef.current;
    if (!s || !cv) return;
    cv.width = s.work.width;
    cv.height = s.work.height;
    cv.getContext("2d")?.drawImage(s.work, 0, 0);
    const bg = bgRef.current;
    if (bg) {
      bg.width = s.work.width;
      bg.height = s.work.height;
      bg.getContext("2d")?.drawImage(s.work, 0, 0);
    }
  }, [stage, fitBox]);

  /* ── 결과 패널 측정 오버레이 (프레임 좌표계) ──
     외곽선·전장·폭·조정점·40mm 기준 원만 그리고 수치는 전용 여백 패널에 둔다. */
  useEffect(() => {
    if (stage !== "result" || !det) return;
    const s = successRef.current;
    const cv = resultOverlayRef.current;
    if (!s || !cv) return;
    const W = s.work.width, H = s.work.height;
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawResultOverlay(ctx, det, W, H);
  }, [stage, det, fitBox]);

  /* ── 돋보기(loupe) 렌더링 ──
     ⚠️ 반드시 위 측정 오버레이 effect "뒤에" 선언한다. 같은 커밋에서 오버레이가 먼저
        갱신돼야 돋보기 안의 측정선이 한 프레임 뒤처지지 않는다 (effect 는 선언 순서로 실행).
     소스는 frozenRef(사진) + resultOverlayRef(측정선)를 같은 소스 사각형으로 겹쳐 그린다.
     배율은 화면 표시 크기 기준이라, 사진이 크게/작게 표시되어도 체감 확대율이 일정하다. */
  useEffect(() => {
    if (stage !== "result" || !loupePoint || !fitBox) return;
    const s = successRef.current;
    const cv = loupeCanvasRef.current;
    const box = loupeBoxRef.current;
    const area = resultAreaRef.current;
    const stageEl = resultStageRef.current;
    const photo = frozenRef.current;
    if (!s || !cv || !box || !area || !stageEl || !photo) return;
    const fw = s.work.width, fh = s.work.height;
    if (!(fw > 0) || !(fh > 0) || !(fitBox.w > 0)) return;

    // ① 배치 — 기본은 사진 영역 상단. 누른 지점이 그 자리와 겹치면(손가락에 가림) 하단으로 피한다.
    //    모든 좌표를 "무대 로컬" 로 계산하므로 회전 무대에서도 그대로 성립한다.
    const rad = (resultPhotoRotDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = (loupePoint.x - 0.5) * fitBox.w;
    const dy = (loupePoint.y - 0.5) * fitBox.h;
    const pointX = area.offsetLeft + area.clientWidth / 2 + (dx * cos - dy * sin);
    const pointY = area.offsetTop + area.clientHeight / 2 + (dx * sin + dy * cos);
    const topY = area.offsetTop + LOUPE_EDGE_GAP;
    const bottomY = area.offsetTop + area.clientHeight - LOUPE_SIZE - LOUPE_EDGE_GAP;
    const centerX = stageEl.clientWidth / 2;
    const hidesPoint = (y: number) =>
      Math.abs(pointX - centerX) < LOUPE_SIZE / 2 + LOUPE_AVOID_MARGIN &&
      pointY > y - LOUPE_AVOID_MARGIN && pointY < y + LOUPE_SIZE + LOUPE_AVOID_MARGIN;
    const placeY = hidesPoint(topY) && !hidesPoint(bottomY) ? bottomY : topY;
    box.style.top = `${Math.max(0, placeY)}px`;

    // ② 확대 렌더링
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const D = Math.max(1, Math.round(LOUPE_SIZE * dpr));
    if (cv.width !== D) cv.width = D;
    if (cv.height !== D) cv.height = D;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const displayScale = fitBox.w / fw;                     // 화면 px / 프레임 px
    const span = LOUPE_SIZE / (LOUPE_ZOOM * displayScale);  // 원 안에 담을 프레임 픽셀 폭
    const sx = loupePoint.x * fw - span / 2;
    const sy = loupePoint.y * fh - span / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 사진 가장자리를 볼 때 프레임 밖은 검게 — 소스 사각형을 잘라내지 않아야 중심이 정확히 맞는다
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, D, D);
    ctx.save();
    // 사용자가 보는 방향과 같도록, 무대 안에서 사진에 걸린 회전을 그대로 적용한다
    ctx.translate(D / 2, D / 2);
    ctx.rotate(rad);
    ctx.translate(-D / 2, -D / 2);
    ctx.drawImage(photo, sx, sy, span, span, 0, 0, D, D);
    const ov = resultOverlayRef.current;
    if (ov) ctx.drawImage(ov, sx, sy, span, span, 0, 0, D, D);
    ctx.restore();

    // ③ 중심 십자선 — 지금 잡고 있는 정확한 지점 (회전과 무관하게 화면 기준)
    const c = D / 2;
    const arm = D * 0.11;
    ctx.lineCap = "round";
    for (const [color, w] of [["rgba(0,0,0,0.55)", 3.4 * dpr], ["rgba(255,255,255,0.95)", 1.4 * dpr]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(c - arm, c); ctx.lineTo(c - arm * 0.3, c);
      ctx.moveTo(c + arm * 0.3, c); ctx.lineTo(c + arm, c);
      ctx.moveTo(c, c - arm); ctx.lineTo(c, c - arm * 0.3);
      ctx.moveTo(c, c + arm * 0.3); ctx.lineTo(c, c + arm);
      ctx.stroke();
    }
  }, [stage, loupePoint, det, fitBox, resultPhotoRotDeg]);

  /* ── 끝점 이동 후 길이/폭 재계산 (스캔 성공 경로와 동일 공식) ── */
  const recomputeMeasures = useCallback((d: Detection, w: number, h: number): Detection => {
    const diameterPx = 2 * d.ballN.r * w;
    let lengthCm: number | null = null;
    let widthCm: number | null = null;
    if (diameterPx > 0) {
      const mmPerPixel = REF_DIAMETER_MM / diameterPx;
      const px = Math.hypot((d.tailN.x - d.headN.x) * w, (d.tailN.y - d.headN.y) * h);
      lengthCm = Math.round((px * mmPerPixel) / 10 * 10) / 10;
      if (d.widthN) {
        const wpx = Math.hypot(
          (d.widthN.bottom.x - d.widthN.top.x) * w,
          (d.widthN.bottom.y - d.widthN.top.y) * h,
        );
        widthCm = wpx > 0 ? Math.round((wpx * mmPerPixel) / 10 * 10) / 10 : null;
      }
    }
    return { ...d, lengthCm, widthCm };
  }, []);

  /* ── 결과 패널: 머리/꼬리/폭 끝점 드래그 수정 ──
     드래그 레이어가 프레임 비율 유지 표시 박스(fitBox)와 정확히 일치하므로
     레이어 정규화 좌표 = 프레임 정규화 좌표 */
  const onEditPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = successRef.current;
    if (!s) return;
    const local = pointerToLocalNorm(e.currentTarget, e.clientX, e.clientY, resultRotDegRef.current);
    if (!local) return;
    const nx = local.x;
    const ny = local.y;
    const rect = { width: local.width, height: local.height };
    const d = s.det;
    const cands: Array<["head" | "tail" | "widthTop" | "widthBottom", Norm]> = [
      ["head", d.headN],
      ["tail", d.tailN],
    ];
    if (d.widthN) {
      cands.push(["widthTop", d.widthN.top], ["widthBottom", d.widthN.bottom]);
    }
    let best: typeof dragKeyRef.current = null;
    let bestDist = Infinity;
    for (const [k, p] of cands) {
      const dist = Math.hypot((p.x - nx) * rect.width, (p.y - ny) * rect.height);
      if (dist < bestDist) { bestDist = dist; best = k; }
    }
    if (best == null || bestDist > 44) return; // 끝점 근처(44px)에서만 드래그 시작
    dragKeyRef.current = best;
    setActiveDragKey(best);
    e.currentTarget.setPointerCapture(e.pointerId);
    // 끝점을 잡은 채로 LOUPE_LONG_PRESS_MS 이상 누르고 있으면 돋보기를 띄운다.
    // 이동해도 취소하지 않는다 — 미세 조정은 "누른 채 끌기"가 기본 동작이라
    // 움직임에서 취소하면 정작 필요한 순간에 돋보기가 뜨지 않는다.
    loupePointRef.current = { x: nx, y: ny };
    if (loupeTimerRef.current) clearTimeout(loupeTimerRef.current);
    loupeTimerRef.current = setTimeout(() => {
      loupeTimerRef.current = null;
      if (dragKeyRef.current && loupePointRef.current) setLoupePoint(loupePointRef.current);
    }, LOUPE_LONG_PRESS_MS);
  }, []);

  /** 돋보기 롱프레스 타이머 · 표시 상태 정리 (드래그 종료 · 초기화 · 언마운트 공용) */
  const clearLoupe = useCallback(() => {
    if (loupeTimerRef.current) { clearTimeout(loupeTimerRef.current); loupeTimerRef.current = null; }
    loupePointRef.current = null;
    setLoupePoint(null);
  }, []);

  const onEditPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const key = dragKeyRef.current;
    const s = successRef.current;
    if (!key || !s) return;
    const local = pointerToLocalNorm(e.currentTarget, e.clientX, e.clientY, resultRotDegRef.current);
    if (!local) return;
    const nx = Math.min(1, Math.max(0, local.x));
    const ny = Math.min(1, Math.max(0, local.y));
    const d = s.det;
    const next: Detection = {
      ...d,
      headN: key === "head" ? { x: nx, y: ny } : d.headN,
      tailN: key === "tail" ? { x: nx, y: ny } : d.tailN,
      widthN: d.widthN
        ? {
            top: key === "widthTop" ? { x: nx, y: ny } : d.widthN.top,
            bottom: key === "widthBottom" ? { x: nx, y: ny } : d.widthN.bottom,
          }
        : null,
    };
    const rec = recomputeMeasures(next, s.work.width, s.work.height);
    s.det = rec; // confirm()이 수정된 좌표를 사용하도록 동기화
    setDet(rec);
    // 돋보기는 끌고 있는 끝점을 계속 따라간다 (아직 안 떴으면 타이머 만료 시점의 위치로 쓰인다)
    loupePointRef.current = { x: nx, y: ny };
    setLoupePoint((prev) => (prev ? { x: nx, y: ny } : prev));
  }, [recomputeMeasures]);

  const onEditPointerUp = useCallback(() => {
    dragKeyRef.current = null;
    setActiveDragKey(null);
    clearLoupe();
  }, [clearLoupe]);

  const resetMeasurementPoints = useCallback(() => {
    const s = successRef.current;
    const initial = initialDetectionRef.current;
    if (!s || !initial) return;
    const restored = cloneDetection(initial);
    s.det = restored;
    dragKeyRef.current = null;
    setActiveDragKey(null);
    clearLoupe();
    setDet(restored);
  }, [clearLoupe]);

  /* ── 재촬영: 이전 측정의 모든 흔적을 지우고 스캔 단계로 복귀 ──
     결과 화면은 세로/가로가 회전 무대(resultStageStyle) 하나를 공유하므로 버튼도 이 하나뿐이다.
     state 초기화만으로는 부족하다 — 캔버스 픽셀은 React 상태가 아니라서, effect 가
     다시 그리기 전까지(또는 effect 가 조기 return 으로 clearRect 를 건너뛰면 계속)
     이전 측정 오버레이가 화면에 그대로 남는다. 클릭 즉시 동기적으로 전부 지운다. */
  const handleRetake = useCallback(() => {
    // clearRect 보다 먼저 플래그를 세워, 배치 커밋 전 drawOverlay 가 구 det 로 그리는 것을 차단한다
    isRetakingRef.current = true;
    // ① 진행 중/늦게 도착할 비동기 응답 무효화 — 회차 ID 를 올려 이전 회차의
    //    outline 응답이 재촬영 후 상태를 되살리지 못하게 한다 (abort 만으로는
    //    이미 완료된 응답의 후속 처리를 막지 못한다)
    scanIdRef.current += 1;
    aiOutlineAbortRef.current?.abort();
    aiOutlineAbortRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    // ② 감지·결과 상태 초기화
    successRef.current = null;
    finalizedFrameRef.current = null;
    frameTurnRef.current = null;
    initialDetectionRef.current = null;
    consecutiveSuccessRef.current = 0;
    refMissRef.current = 0;
    fishMissRef.current = 0;
    bothMissRef.current = 0;
    totalFailRef.current = 0;
    // 이전 프레임의 YOLO 박스·크기 카드가 스캔 복귀 직후 다시 그려지는 것 방지
    yoloRef.current = null;
    dragKeyRef.current = null;
    setActiveDragKey(null);
    clearLoupe();
    setDet(null);
    setFrameTurn(null);
    setKeyringTilted(false);
    setPlaneMismatch(false);
    // ③ 이전 측정 오버레이가 그려진 캔버스를 즉시 비운다 (다음 페인트 전에 확정)
    //    frozenRef/resultOverlayRef/bgRef 는 결과 화면과 함께 언마운트되지만,
    //    같은 프레임에 재진입하는 경우까지 대비해 남은 픽셀을 모두 지운다.
    for (const ref of [overlayRef, resultOverlayRef, frozenRef, bgRef, lockedFrameRef]) {
      const cv = ref.current;
      if (!cv) continue;
      cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
    }
    goStage("scan");
  }, [clearLoupe, goStage]);

  /* ── 결과 화면을 벗어나거나 언마운트되면 롱프레스 타이머를 반드시 정리한다 ── */
  useEffect(() => {
    if (stage === "result") return;
    clearLoupe();
  }, [stage, clearLoupe]);
  useEffect(() => () => { if (loupeTimerRef.current) clearTimeout(loupeTimerRef.current); }, []);

  /* ── 재촬영 플래시 방지 플래그 해제 ──
     handleRetake 에서 isRetakingRef.current = true 로 세운 뒤,
     스캔 단계로 안정화(det=null, stage="scan")되면 false 로 돌려
     이후 drawOverlay 가 정상적으로 YOLO/측정 오버레이를 그릴 수 있게 한다. */
  useEffect(() => {
    if (stage === "scan" && !det) {
      isRetakingRef.current = false;
    }
  }, [stage, det]);

  /* ── no-ref-warning → 1.5초 후 자동으로 ref-missing 모달로 전환 ── */
  useEffect(() => {
    if (stage !== "no-ref-warning") return;
    const t = setTimeout(() => goStage("ref-missing"), 1500);
    return () => clearTimeout(t);
  }, [stage, goStage]);

  /* ── no-fish-warning → 1.5초 후 자동으로 fish-missing 모달로 전환 ── */
  useEffect(() => {
    if (stage !== "no-fish-warning") return;
    const t = setTimeout(() => goStage("fish-missing"), 1500);
    return () => clearTimeout(t);
  }, [stage, goStage]);

  /* ── no-both-warning → 1.5초 후 자동으로 both-missing 모달로 전환 ── */
  useEffect(() => {
    if (stage !== "no-both-warning") return;
    const t = setTimeout(() => goStage("both-missing"), 1500);
    return () => clearTimeout(t);
  }, [stage, goStage]);

  /* ── 기준물 미감지 안내 '예' → 카메라 닫고 선택 화면 복귀 ── */
  const closeAfterRefMissing = useCallback(() => {
    cleanupStream();
    onClose();
  }, [cleanupStream, onClose]);

  /* ── 기준물 미감지 안내 '아니오' → 팝업만 닫고 카메라 유지 (미감지 카운터 리셋) ── */
  const keepScanningAfterRefMissing = useCallback(() => {
    refMissRef.current = 0;
    fishMissRef.current = 0;
    bothMissRef.current = 0;
    totalFailRef.current = 0;
    goStage("scan");
  }, [goStage]);

  /* ── 물고기 미감지 안내 '예' → 카메라 닫고 선택 화면 복귀 ── */
  const closeAfterFishMissing = useCallback(() => {
    cleanupStream();
    onClose();
  }, [cleanupStream, onClose]);

  /* ── 물고기 미감지 안내 '아니오' → 팝업만 닫고 카메라 유지 ── */
  const keepScanningAfterFishMissing = useCallback(() => {
    refMissRef.current = 0;
    fishMissRef.current = 0;
    bothMissRef.current = 0;
    totalFailRef.current = 0;
    goStage("scan");
  }, [goStage]);

  /* ── 둘 다 미감지 안내 '예' → 카메라 닫고 선택 화면 복귀 ── */
  const closeAfterBothMissing = useCallback(() => {
    cleanupStream();
    onClose();
  }, [cleanupStream, onClose]);

  /* ── 둘 다 미감지 안내 '아니오' → 팝업만 닫고 카메라 유지 ── */
  const keepScanningAfterBothMissing = useCallback(() => {
    refMissRef.current = 0;
    fishMissRef.current = 0;
    bothMissRef.current = 0;
    totalFailRef.current = 0;
    goStage("scan");
  }, [goStage]);

  const canConfirm = !!det;

  /* ── 결과 패널 표시값 (추정 무게 · 신뢰도 등급) — 표시 전용 계산 ── */
  const resultWeightG =
    det?.lengthCm != null
      ? ((det.widthCm != null ? estimateWeightByWidth(det.lengthCm, det.widthCm, fishSpecies) : null) ??
        estimateWeight(det.lengthCm, fishSpecies))
      : null;
  // 기준물(입낚볼) 감지 여부 — 결과 패널 안내 문구 분기 (측정은 항상 볼 기준)
  const ballFound = !!det && det.ballN.r > 0;
  const activePointLabel =
    activeDragKey === "head" ? "입" :
    activeDragKey === "tail" ? "꼬리" :
    activeDragKey === "widthTop" ? "등" :
    activeDragKey === "widthBottom" ? "배" : null;

  /* ── 윤곽 감지 상태별 안내 문구 ── */
  const scanGuide: { main: string; sub: string; locked: boolean } =
    scanStatus === "locked"
      ? { main: "물고기 윤곽 인식됨 · 측정 중...", sub: `${refLabel}과 함께 촬영해 주세요`, locked: true }
      : scanStatus === "too-small"
      ? { main: "물고기가 너무 작게 보여요", sub: "조금 더 가까이에서 비춰주세요", locked: false }
      : scanStatus === "too-large"
      ? { main: "물고기가 화면에 꽉 찼어요", sub: "조금 더 멀리서 비춰주세요", locked: false }
      : {
          main: "물고기를 화면 중앙에 놓아주세요",
          sub: refType === "keyring"
            ? "키링을 바닥에 평평하게 놓고 물고기 전체가 화면에 보이게 맞춰주세요"
            : "입낚볼과 함께 물고기 전체가 화면에 보이게 맞춰주세요",
          locked: false,
        };

  /* ── 안내 문구 본문 (세로/가로 공용) — 단계별로 하나만 렌더 ── */
  const guidanceBody = keyringTilted && stage === "scan" ? (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-orange-300">
        <AlertTriangle size={14} strokeWidth={2.2} />
        키링이 비스듬하게 보여요
      </p>
      <p className="text-[11px] text-white/60">
        키링을 바닥에 수평으로 놓고 카메라를 더 수직으로 세워서 다시 찍어주세요
      </p>
    </div>
  ) : planeMismatch && stage === "scan" ? (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-orange-300">
        <AlertTriangle size={14} strokeWidth={2.2} />
        {refLabel}과 물고기의 거리가 달라요
      </p>
      <p className="text-[11px] text-white/60">
        {refLabel}과 물고기가 비슷한 거리에 있도록 맞춰 주세요
      </p>
    </div>
  ) : stage === "shimmer" ? (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-aqua-300">
      <ScanLine size={15} strokeWidth={2.2} />
      인식 완료 — 측정 중이에요...
    </p>
  ) : canConfirm ? (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-green-400">
      <Check size={15} strokeWidth={2.5} />
      인식 완료 — '측정하기'를 눌러 확정하세요
    </p>
  ) : (
    <div
      className="flex flex-col items-center gap-1 text-center"
      style={scanGuide.locked ? undefined : { animation: "slowBlink 3s ease-in-out infinite" }}
    >
      <p className={"flex items-center gap-1.5 text-[13px] font-semibold " + (scanGuide.locked ? "text-sky-300" : "text-white/90")}>
        {scanGuide.locked && <ScanLine size={14} strokeWidth={2.2} />}
        {scanGuide.main}
      </p>
      <p className="text-[11px] text-white/55">{scanGuide.sub}</p>
    </div>
  );

  /* ── 안내 텍스트 컨테이너 ──
     카메라 영상이나 뒤쪽 오버레이의 글자가 비쳐 보이지 않도록 불투명 배경 위에 표시한다 */
  const guidance = (
    <div className="mx-auto w-max max-w-[92%] rounded-2xl bg-[#0b1e2e] px-4 py-2.5 shadow-lg ring-1 ring-white/10">
      {guidanceBody}
    </div>
  );

  /* ── 측정하기 버튼 (세로 모드 — 원형, 아쿠아 반투명) → 스캐너 내 결과 패널 열기 ── */
  const measureButton = (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={openResult}
        disabled={!canConfirm}
        className={
          "flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-full text-[11px] font-bold transition-all active:scale-[0.94] " +
          (canConfirm
            ? "bg-aqua-500/85 text-white shadow-lg shadow-aqua-500/40"
            : "bg-aqua-500/15 text-aqua-100/35")
        }
      >
        <ScanLine size={22} strokeWidth={2} />
        <span>측정하기</span>
      </button>
    </div>
  );

  // CSS 회전 트릭 필요 시 컨테이너 스타일
  // 100dvh = iOS Safari 주소창/하단 네비게이션 제외한 실제 보이는 뷰포트 높이
  const outerStyle: React.CSSProperties = needsCssRotation
    ? {
        position: "fixed",
        width: "100dvh",
        height: "100vw",
        top: "calc(50dvh - 50vw)",
        left: "calc(50vw - 50dvh)",
        transform: "rotate(90deg)",
        zIndex: 400,
        overflow: "hidden",
        backgroundColor: "black",
      }
    : {};

  /* 결과 화면 무대(stage) — 루트(fixed inset-0) 안에서만 회전한다.
     세로 고정 브라우저에서 가로로 촬영한 경우, 사용자는 폰을 눕혀 들고 있으므로
     촬영 UI 와 동일하게 90° 회전해야 배지·수치·버튼이 바로 서서 보인다. */
  const resultStageStyle: React.CSSProperties = needsCssRotation
    ? {
        position: "absolute",
        width: "100dvh",
        height: "100vw",
        top: "calc(50dvh - 50vw)",
        left: "calc(50vw - 50dvh)",
        transform: "rotate(90deg)",
        overflow: "hidden",
      }
    : { position: "absolute", inset: 0, overflow: "hidden" };

  return (
  <>
    {/* 안내 텍스트 느린 깜빡임 keyframe */}
    <style>{`
      @keyframes slowBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
      @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0.4) translateY(0px); }
        40%, 60% { opacity: 1; transform: scale(1.15) translateY(-5px); }
      }
      @keyframes sparkleFloat {
        0%, 100% { opacity: 0; transform: scale(0.6) translateY(3px) rotate(0deg); }
        50% { opacity: 0.85; transform: scale(1.1) translateY(-6px) rotate(30deg); }
      }
      @keyframes sparkleDrift {
        0%, 100% { opacity: 0; transform: scale(0.5) translateX(0px) translateY(0px); }
        30% { opacity: 0.9; transform: scale(1.2) translateX(-4px) translateY(-8px); }
        70% { opacity: 0.6; transform: scale(0.9) translateX(5px) translateY(-4px); }
      }
      /* AI 측정 결과 — 어종 칩 가로 스크롤 (스크롤바 숨김) */
      .ipnak-chip-row { scrollbar-width: none; -ms-overflow-style: none; }
      .ipnak-chip-row::-webkit-scrollbar { display: none; }
    `}</style>

    {/* ── video/canvas는 항상 z-399 portrait fixed 레이어에 단일 배치 ──
        이유: needsCssRotation이 바뀔 때 조건부 렌더링 시 video 엘리먼트가 unmount/remount되어
              srcObject(MediaStream)가 새 엘리먼트에 전달되지 않아 검은 화면 발생.
              video를 항상 동일한 DOM 위치에 두면 ref와 srcObject가 유지되어 검은 화면 없음.
              CSS 회전 모드: portrait 스트림을 portrait fixed에 표시 → 왜곡 없음.
              네이티브 가로 / 세로: 동일 레이어 그대로 사용.  */}
    <div className="fixed inset-0 z-[399] overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }}
      />
      {/* AI 판정 프레임 고정 레이어 — 응답 이후 휴대폰이 움직여도 측정선이 밀리지 않는다. */}
      {stage === "shimmer" && (
        <canvas
          ref={lockedFrameRef}
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, zIndex: 9 }}
        />
      )}
      {/* ⚠️ objectFit cover 필수 — video 와 동일한 크롭을 적용해야 감지 좌표(머리/꼬리 끝점·볼 원)가
          화면에 보이는 영상과 정확히 일치한다 (기본값 fill 은 화면 비율 ≠ 영상 비율일 때 좌표가 어긋남) */}
      <canvas
        ref={overlayRef}
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10 }}
      />
      {/* ── 실시간 물고기 윤곽 반짝임 (인식 완료 시 자동 종료) ──
          ⚠️ 반드시 video 와 같은 레이어에 둔다. UI 컨테이너는 CSS 회전 모드에서
             rotate(90deg) 되므로, 그 안에 두면 윤곽 좌표가 카메라 화면과 어긋난다. */}
      <FishScanGlow
        active={camStatus === "ready" && videoHasData && stage === "scan"}
        sourceRef={videoRef}
        objectFit="cover"
        label={null} /* 상단 배지·하단 안내와 겹치지 않도록 문구는 부모가 배치 */
        onStatusChange={handleScanStatus}
        silent /* 카메라에서는 윤곽선을 그리지 않는다 — 인식 후 윤슬만 노출 */
      />
      {/* ── 윤슬(빛 포인트) 한 바퀴 → 완료 시 자동 측정 ── */}
      {/* 인식 시점에 검증된 윤곽을 그대로 넘긴다 — 윤슬이 자체 재감지로 다른 영역을 돌지 않게 한다.
          (윤곽 검증에 실패한 프레임은 null → 기존처럼 FALLBACK 시간 뒤 자동 완료) */}
      <FishShimmer
        active={stage === "shimmer"}
        sourceRef={lockedFrameRef}
        contour={stage === "shimmer" ? det?.contourN ?? null : null}
        objectFit="cover"
        durationMs={SHIMMER_MS}
        onComplete={handleShimmerComplete}
      />
      {/* ── 반짝이는 파티클 오버레이 — scan 탐색 중에만 표시, 인식 완료 시 사라짐 ── */}
      {stage === "scan" && camStatus === "ready" && videoHasData && (
        <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                background: s.color,
                boxShadow: `0 0 ${s.glow}px ${s.color}`,
                animation: `${s.anim} ${s.duration}s ${s.delay}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>

    {/* ── UI 오버레이 컨테이너 (z-400, 투명 배경) — CSS 회전 모드일 때 rotate(90deg) 적용 ──
        ⚠️ 카메라 미리보기가 실제로 살아 있을 때(camStatus === "ready")만 렌더한다.
        여기 들어 있는 것은 전부 라이브 스트림용 UI(상단 바·안내·촬영 컨트롤)이고,
        회전이 걸리는 유일한 레이어다. 준비 중·권한 오류 상태에서도 함께 그리면
        회전된 상단 바와 컨트롤이 세로 안내 화면 뒤에 남아 글자가 옆으로 누운 것처럼 보인다.
        권한/오류 안내는 이 컨테이너 밖의 세로 고정 레이어에서 그린다(아래 참조). */}
    {camStatus === "ready" && (
    <div
      className={!needsCssRotation ? "fixed inset-0 z-[400] overflow-hidden" : undefined}
      style={needsCssRotation ? { ...outerStyle, backgroundColor: "transparent" } : undefined}
    >
      {/* ── 상단 바 — 결과 패널(stage === "result")은 회전 컨테이너 밖 자체 상단 바를 쓴다 ── */}
      {stage !== "result" && (
        <div
          className={
            "absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent py-3 " +
            (!effectiveLandscape ? "pt-safe px-4" : "pr-4")
          }
          style={
            effectiveLandscape
              ? {
                  right: "calc(88px + max(env(safe-area-inset-bottom, 0px), env(safe-area-inset-right, 0px)))",
                  // CSS 회전 모드: LOCAL left = 노치 방향 → safe-area-inset-top
                  // 네이티브 가로 모드: 왼쪽 = 노치 방향 → safe-area-inset-left
                  // 둘 다 max()로 대응
                  paddingLeft: "max(20px, env(safe-area-inset-top), env(safe-area-inset-left))",
                }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <ScanLine size={17} strokeWidth={1.9} className="text-aqua-400" />
            <span className="text-[14px] font-bold text-white">AI 실시간 스캐너</span>
            <span className="animate-pulse rounded-full bg-aqua-500/20 px-2 py-0.5 text-[10px] font-bold text-aqua-400 ring-1 ring-aqua-500/30">
              입낚 AI 측정 중
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 단계 표시 */}
            <span className="whitespace-nowrap text-[10.5px] font-semibold tracking-tight text-white/60">
              1단계 · 물고기와 입낚볼 인식 및 계측
            </span>
            {/* 세로/가로 전환 버튼 — 기기가 자동회전 중에는 숨김 */}
            {!browserIsLandscape && (
              <button
                type="button"
                onClick={() => setIsLandscape((v) => { isLandscapeRef.current = !v; return !v; })}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20"
              >
                <RotateCw size={12} strokeWidth={2} />
                {effectiveLandscape ? "세로로" : "가로로"}
              </button>
            )}
            {/* 플래시(토치) — 어두운 곳에서 스캔할 때 쓰므로 촬영 단계에 둔다 */}
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label="플래시"
                aria-pressed={torchOn}
                className={
                  "rounded-full p-2 transition-colors " +
                  (torchOn ? "bg-yellow-400/25 text-yellow-400" : "bg-white/10 text-white hover:bg-white/20")
                }
              >
                <Zap size={17} strokeWidth={2} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="닫기"
              className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <X size={19} />
            </button>
          </div>
        </div>
      )}

      {/* ── 화면 중앙 안내 문구 — scan 탐색 중 + 카메라 준비 완료 시만 표시 ── */}
      {stage === "scan" && camStatus === "ready" && videoHasData && !canConfirm && !keyringTilted && !planeMismatch && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1"
          style={{ top: "50%", transform: "translateY(-50%)", animation: "slowBlink 2.8s ease-in-out infinite" }}
        >
          <p
            className="text-[15px] font-bold tracking-tight text-white"
            style={{ textShadow: "0 0 12px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.9)" }}
          >
            물고기와 {refLabel}을 함께 비춰주세요
          </p>
          <p
            className="text-[11px] text-white/65"
            style={{ textShadow: "0 0 8px rgba(0,0,0,0.9)" }}
          >
            {refType === "keyring"
              ? "키링은 바닥에 평평하게 놓고 위에서 수직으로 촬영해 주세요"
              : "AI가 자동으로 인식합니다"}
          </p>
        </div>
      )}

      {/* 감지 시 상단 배지 — 결과 패널에서는 데이터 패널이 대신한다 */}
      {canConfirm && stage !== "result" && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2">
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-3 py-1.5 text-[12px] font-bold text-white shadow-lg">
            <Check size={14} strokeWidth={2.6} />
            물고기 인식됨
            {det?.lengthCm != null && <span className="ml-0.5">· 약 {det.lengthCm}cm</span>}
            {det?.widthCm != null && <span className="ml-0.5">· 폭 {det.widthCm}cm</span>}
          </span>
        </div>
      )}

      {/* 카메라 준비 중 / 권한 오류 안내는 회전 컨테이너 밖(아래쪽)에서 세로로 그린다 */}

      {/* ── 하단 컨트롤 (세로 모드) ── */}
      {/* camStatus 는 이 컨테이너 조건(=== "ready")으로 이미 좁혀져 있어 따로 확인하지 않는다 */}
      {!effectiveLandscape && stage !== "result" && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-5 pt-10">
          {/* scan 탐색 중에는 중앙 깜빡이는 흰 글씨가 안내 대신하므로 카드 숨김
              (키링 각도 경고는 예외 — 재촬영 방법을 바로 알려야 한다) */}
          {(stage !== "scan" || canConfirm || keyringTilted || planeMismatch) && <div className="mb-3">{guidance}</div>}
          {measureButton}
        </div>
      )}

      {/* ── 안내 오버레이 — 가로 모드 시 카메라 왼쪽 영역 중앙 ── */}
      {effectiveLandscape && stage !== "result" && (stage !== "scan" || canConfirm || keyringTilted || planeMismatch) && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-30 flex flex-col items-center justify-center"
          style={{
            // CSS 회전: safe-area-inset-bottom(=landscape right)
            // 네이티브 가로: safe-area-inset-right(=landscape right)
            right: "calc(88px + max(env(safe-area-inset-bottom, 0px), env(safe-area-inset-right, 0px)))",
          }}
        >
          {guidance}
        </div>
      )}

      {/* ── 우측 컨트롤 패널 (가로 모드) ── */}
      {/* CSS 회전 모드: LOCAL right = 가로화면 오른쪽 = 홈인디케이터(safe-area-inset-bottom) */}
      {/* 네이티브 가로 모드: 오른쪽 = 홈인디케이터(safe-area-inset-right) */}
      {effectiveLandscape && stage !== "result" && (
        <div
          className="absolute inset-y-0 right-0 z-30 flex flex-col items-center"
          style={{
            background: "rgba(0,0,0,0.75)",
            width: "calc(88px + max(env(safe-area-inset-bottom, 0px), env(safe-area-inset-right, 0px)))",
            paddingRight: "max(4px, env(safe-area-inset-bottom, 0px), env(safe-area-inset-right, 0px))",
          }}
        >
          <div className="h-14 shrink-0" />
          <div className="flex-1" />
          {/* 측정하기 (원형, 아쿠아 반투명) → 스캐너 내 결과 패널 열기 */}
          <button
            type="button"
            onClick={openResult}
            disabled={!canConfirm}
            className={
              "flex h-[60px] w-[60px] flex-col items-center justify-center gap-1 rounded-full text-[10px] font-bold transition-all active:scale-[0.94] " +
              (canConfirm
                ? "bg-aqua-500/85 text-white shadow-lg shadow-aqua-500/40"
                : "bg-aqua-500/15 text-aqua-100/35")
            }
          >
            <ScanLine size={19} strokeWidth={2} />
            <span>측정하기</span>
          </button>
          <div className="flex-[2]" />
        </div>
      )}

    </div>
    )}

    {/* ── 결과 화면 (stage === "result") — 풀스크린 사진 + 우측 글라스 카드 오버레이 ── */}
    {stage === "result" && det && (
      <div
        data-testid="ai-measurement-result"
        className="fixed inset-0 z-[401] overflow-hidden bg-black"
        style={{ width: "100vw", height: "100dvh" }}
      >
        <div ref={resultStageRef} style={resultStageStyle}>
          {/* 배경 블러 */}
          <canvas
            ref={bgRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ objectFit: "cover", filter: "blur(26px)", transform: "scale(1.15)", opacity: 0.45 }}
          />

          {/* ── 사진 영역 — 전체 화면 (contain, 비율 유지) ── */}
          <div
            ref={resultAreaRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
          >
            {fitBox && (
              <div
                className="relative"
                style={{
                  width: fitBox.w,
                  height: fitBox.h,
                  transform: resultPhotoRotDeg ? `rotate(${resultPhotoRotDeg}deg)` : undefined,
                }}
              >
                <canvas ref={frozenRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                <canvas ref={resultOverlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                <div
                  className="absolute inset-0"
                  style={{ touchAction: "none" }}
                  onPointerDown={onEditPointerDown}
                  onPointerMove={onEditPointerMove}
                  onPointerUp={onEditPointerUp}
                  onPointerCancel={onEditPointerUp}
                />
              </div>
            )}
          </div>

          {/* ── 상단 — X닫기(좌) + 인식완료 배지(우) ── */}
          <div
            className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4"
            style={{ paddingTop: SAFE_LOCAL_TOP, height: RESULT_TOP_INSET }}
          >
            <button
              type="button"
              onClick={() => { cleanupStream(); onClose(); }}
              aria-label="닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-3.5 py-1.5 shadow-lg backdrop-blur-sm ring-1 ring-green-300/30">
              <Check size={13} strokeWidth={2.8} className="shrink-0 text-white" />
              <span className="text-[12px] font-extrabold text-white">인식 완료</span>
            </div>
          </div>

          {/* ── 우측 — 측정값 글라스 카드 (세로 중앙 정렬) ── */}
          <div
            className="absolute right-3 z-30 flex flex-col gap-2"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            {/* 길이 */}
            <div className="w-[108px] rounded-2xl bg-black/52 px-3 py-2.5 shadow-xl backdrop-blur-md ring-1 ring-white/14">
              <div className="mb-1 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M2 12h20M2 6l4 6-4 6M22 6l-4 6 4 6"/></svg>
                <span className="text-[10px] font-semibold text-white/45">길이</span>
              </div>
              <p className="leading-none">
                <span className="text-[24px] font-black text-white">
                  {det.lengthCm != null ? det.lengthCm.toFixed(1) : "—"}
                </span>
                <span className="ml-1 text-[12px] font-bold text-white/55">cm</span>
              </p>
            </div>

            {/* 폭 */}
            <div className="w-[108px] rounded-2xl bg-black/52 px-3 py-2.5 shadow-xl backdrop-blur-md ring-1 ring-white/14">
              <div className="mb-1 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/></svg>
                <span className="text-[10px] font-semibold text-white/45">폭</span>
              </div>
              <p className="leading-none">
                <span className="text-[24px] font-black text-white">
                  {det.widthCm != null ? det.widthCm.toFixed(1) : "—"}
                </span>
                <span className="ml-1 text-[12px] font-bold text-white/55">cm</span>
              </p>
            </div>

            {/* 무게 */}
            <div className="w-[108px] rounded-2xl bg-black/52 px-3 py-2.5 shadow-xl backdrop-blur-md ring-1 ring-white/14">
              <div className="mb-1 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                <span className="text-[10px] font-semibold text-white/45">무게</span>
              </div>
              <p className="text-[20px] font-black leading-none text-white">
                {resultWeightG != null ? formatWeight(resultWeightG) : "—"}
              </p>
            </div>

            {/* 어종 */}
            <div className="w-[108px] rounded-2xl bg-black/52 px-3 py-2.5 shadow-xl backdrop-blur-md ring-1 ring-white/14">
              <div className="mb-1 flex items-center gap-1">
                <span className="text-[10px] font-semibold text-white/45">어종</span>
              </div>
              <p className="truncate text-[14px] font-black leading-none text-white">
                {fishSpecies || "기타"}
              </p>
            </div>
          </div>

          {/* ── 하단 — 어종칩 + 편집버튼 (좌하단) ── */}
          <div
            className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pt-8"
            style={{ paddingBottom: SAFE_LOCAL_BOTTOM }}
          >
            {/* 어종 선택 칩 */}
            <div className="ipnak-chip-row mb-2.5 flex gap-1.5 overflow-x-auto pr-24">
              {FISH_SPECIES.map((s: { key: string }) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFishSpecies(s.key)}
                  aria-pressed={fishSpecies === s.key}
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors " +
                    (fishSpecies === s.key
                      ? "bg-yellow-400 text-black shadow-md"
                      : "bg-white/15 text-white/65 hover:bg-white/25")
                  }
                >
                  {s.key}
                </button>
              ))}
            </div>

            {/* 버튼 행 */}
            <div className="flex items-center gap-2 pb-1">
              {/* 재촬영 */}
              <button
                type="button"
                onClick={handleRetake}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-[12px] font-bold text-white ring-1 ring-white/10 backdrop-blur-sm active:scale-[0.97]"
              >
                <RotateCw size={13} strokeWidth={2.2} />
                재촬영
              </button>
              <div className="flex-1" />
            </div>
          </div>

          {/* ── 우하단 고정 — 확인 버튼 ── */}
          <div
            className="absolute right-3 z-30"
            style={{ bottom: `calc(${SAFE_LOCAL_BOTTOM} + 12px)` }}
          >
            <button
              type="button"
              onClick={confirm}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-[#1a3a5c]/90 px-4 text-[12px] font-extrabold text-white shadow-lg backdrop-blur-sm active:scale-[0.97]"
            >
              <Check size={14} strokeWidth={2.6} />
              확인
            </button>
          </div>

          {/* 돋보기 */}
          {loupePoint && (
            <div
              ref={loupeBoxRef}
              aria-hidden
              className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 overflow-hidden rounded-full bg-black shadow-2xl ring-2 ring-white/80"
              style={{
                width: LOUPE_SIZE,
                height: LOUPE_SIZE,
                top: `calc(${RESULT_TOP_INSET} + ${LOUPE_EDGE_GAP}px)`,
              }}
            >
              <canvas ref={loupeCanvasRef} className="h-full w-full" />
            </div>
          )}

          {!ballFound && (
            <div
              className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4"
              style={{ bottom: `calc(180px + ${SAFE_LOCAL_BOTTOM})` }}
            >
              <span className="rounded-full bg-black/75 px-4 py-2 text-[13px] font-bold text-yellow-300 ring-1 ring-white/15 backdrop-blur-sm">
                40mm 기준물을 다시 맞춰주세요
              </span>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── 기준물 미감지 1단계: "찾을 수 없습니다" 메시지 오버레이 (1.5초) ──
        회전된 카메라 컨테이너 밖에 fixed 로 배치 → 항상 세로(portrait) 방향 표시 */}
    {stage === "no-ref-warning" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[20px] bg-orange-500/20 ring-1 ring-orange-500/35">
            <AlertTriangle size={32} strokeWidth={1.6} className="text-orange-400" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-snug tracking-tight text-white">
              입낚볼 / 입낚키링을<br />찾을 수 없습니다
            </p>
            <p className="mt-2 text-[13px] text-white/50">잠시 후 종료 여부를 확인합니다...</p>
          </div>
        </div>
      </div>
    )}

    {/* ── 물고기 미감지 1단계: "물고기를 찾을 수 없습니다" 메시지 (1.5초) ── */}
    {stage === "no-fish-warning" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[20px] bg-orange-500/20 ring-1 ring-orange-500/35">
            <AlertTriangle size={32} strokeWidth={1.6} className="text-orange-400" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-snug tracking-tight text-white">
              물고기를 찾을 수 없습니다
            </p>
            <p className="mt-2 text-[13px] text-white/50">잠시 후 종료 여부를 확인합니다...</p>
          </div>
        </div>
      </div>
    )}

    {/* ── 물고기 미감지 2단계: 종료 여부 확인 모달 ── */}
    {stage === "fish-missing" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.84)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      >
        <div
          className="w-full max-w-[340px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-white/[0.1]"
          style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400/90 to-orange-700/30" />
          <div className="flex flex-col items-center px-6 pb-5 pt-7">
            <div className="mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-orange-500/15 ring-1 ring-orange-500/25">
              <AlertTriangle size={30} strokeWidth={1.6} className="text-orange-400" />
            </div>
            <p className="text-center text-[16px] font-extrabold leading-relaxed tracking-tight text-white">
              AI 카메라를<br />종료하시겠습니까?
            </p>
            <p className="mt-2.5 text-center text-[13px] leading-relaxed text-white/50">
              입낚볼은 인식됐어요.<br />물고기를 함께 화면에 놓아주세요
            </p>
          </div>
          <div className="flex gap-2 px-4 pb-6 pt-1">
            <button
              type="button"
              onClick={keepScanningAfterFishMissing}
              className="flex-1 rounded-2xl bg-white/10 py-3.5 text-[15px] font-bold text-white/80 transition-all active:scale-[0.98] active:bg-white/20"
            >
              아니오
            </button>
            <button
              type="button"
              onClick={closeAfterFishMissing}
              className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
            >
              예
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 기준물 미감지 2단계: 종료 여부 확인 모달 ──
        '예' 시 카메라를 닫고 이전 선택 화면으로 복귀 / '아니오' 시 카메라를 그대로 유지.
        회전된 카메라 컨테이너 밖에 fixed 로 배치 → 항상 세로(portrait) 방향 표시 */}
    {stage === "ref-missing" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.84)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      >
        <div
          className="w-full max-w-[340px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-white/[0.1]"
          style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400/90 to-orange-700/30" />
          <div className="flex flex-col items-center px-6 pb-5 pt-7">
            <div className="mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-orange-500/15 ring-1 ring-orange-500/25">
              <AlertTriangle size={30} strokeWidth={1.6} className="text-orange-400" />
            </div>
            <p className="text-center text-[16px] font-extrabold leading-relaxed tracking-tight text-white">
              AI 카메라를<br />종료하시겠습니까?
            </p>
            <p className="mt-2.5 text-center text-[13px] leading-relaxed text-white/50">
              물고기는 인식됐어요.<br />입낚볼 / 입낚키링을<br />함께 놓아주세요
            </p>
          </div>
          <div className="flex gap-2 px-4 pb-6 pt-1">
            <button
              type="button"
              onClick={keepScanningAfterRefMissing}
              className="flex-1 rounded-2xl bg-white/10 py-3.5 text-[15px] font-bold text-white/80 transition-all active:scale-[0.98] active:bg-white/20"
            >
              아니오
            </button>
            <button
              type="button"
              onClick={closeAfterRefMissing}
              className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
            >
              예
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 둘 다 미감지 1단계: "물고기와 입낚볼 모두 보이지 않습니다" 메시지 (1.5초) ── */}
    {stage === "no-both-warning" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[20px] bg-orange-500/20 ring-1 ring-orange-500/35">
            <AlertTriangle size={32} strokeWidth={1.6} className="text-orange-400" />
          </div>
          <div>
            <p className="text-[18px] font-extrabold leading-snug tracking-tight text-white">
              물고기와 입낚볼 모두<br />보이지 않습니다
            </p>
            <p className="mt-2 text-[13px] text-white/50">잠시 후 종료 여부를 확인합니다...</p>
          </div>
        </div>
      </div>
    )}

    {/* ── 둘 다 미감지 2단계: 종료 여부 확인 모달 ── */}
    {stage === "both-missing" && (
      <div
        className="fixed inset-0 z-[460] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.84)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      >
        <div
          className="w-full max-w-[340px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-white/[0.1]"
          style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400/90 to-orange-700/30" />
          <div className="flex flex-col items-center px-6 pb-5 pt-7">
            <div className="mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-orange-500/15 ring-1 ring-orange-500/25">
              <AlertTriangle size={30} strokeWidth={1.6} className="text-orange-400" />
            </div>
            <p className="text-center text-[16px] font-extrabold leading-relaxed tracking-tight text-white">
              AI 카메라를<br />종료하시겠습니까?
            </p>
            <p className="mt-2.5 text-center text-[13px] leading-relaxed text-white/50">
              물고기와 입낚볼을 함께<br />화면에 놓고 비춰주세요
            </p>
          </div>
          <div className="flex gap-2 px-4 pb-6 pt-1">
            <button
              type="button"
              onClick={keepScanningAfterBothMissing}
              className="flex-1 rounded-2xl bg-white/10 py-3.5 text-[15px] font-bold text-white/80 transition-all active:scale-[0.98] active:bg-white/20"
            >
              아니오
            </button>
            <button
              type="button"
              onClick={closeAfterBothMissing}
              className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
            >
              예
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 카메라 준비 중 (항상 세로 정방향) ──
        회전이 걸리는 UI 오버레이 컨테이너 밖의 독립 레이어다.
        이 상태에서는 회전 컨테이너 자체가 렌더되지 않으므로 화면에 눕는 요소가 없다.
        상단 바의 X 도 함께 사라지므로 여기서 닫기 수단을 직접 제공한다. */}
    {consented && camStatus === "loading" && (
      <div
        className="fixed inset-0 z-[440] flex flex-col items-center justify-center gap-3 text-white/80"
        style={{ background: "#0b1e2e" }}
      >
        <Loader2 size={30} className="animate-spin text-orange-400" />
        <p className="text-[13px]">카메라 준비 중...</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-[14px] bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          닫기
        </button>
      </div>
    )}

    {/* ── 카메라 권한 미허용 · 오류 안내 (항상 세로 정방향) ──
        불투명 배경으로 덮어 뒤쪽 카메라 레이어가 비치지 않게 한다. */}
    {consented && camStatus === "error" && (
      <div
        className="fixed inset-0 z-[440] flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ background: "#0b1e2e" }}
        role="alertdialog"
        aria-label="카메라를 사용할 수 없습니다"
      >
        <span className="flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-orange-500/15 ring-1 ring-orange-500/25">
          <Camera size={30} strokeWidth={1.6} className="text-orange-400" />
        </span>
        <p className="text-[17px] font-extrabold tracking-tight text-white">카메라를 사용할 수 없어요</p>
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/70">{camError}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-orange-500 px-4 py-2 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-orange-600"
          >
            <RefreshCw size={15} /> 재시도
          </button>
          <button
            onClick={onClose}
            className="rounded-[14px] bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            닫기
          </button>
        </div>
      </div>
    )}

    {/* ── 권한 사전 안내 오버레이 ──
        회전된 카메라 컨테이너 밖에 fixed로 배치 → 항상 세로(portrait) 방향으로 표시 */}
    {!consented && (
      <div
        className="fixed inset-0 z-[450] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      >
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-t-[32px] shadow-2xl ring-1 ring-white/[0.1]"
          style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/30 via-orange-400/90 to-aqua-700/30" />
          <div className="mx-auto mt-3.5 h-1 w-10 rounded-full bg-white/[0.14]" />

          <div className="flex flex-col items-center px-6 pb-4 pt-5">
            <div className="relative mb-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-orange-500 shadow-lg shadow-orange-500/30">
                <Camera size={33} strokeWidth={1.6} className="text-white" />
              </div>
              <span className="absolute -right-1.5 -top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-aqua-500 ring-2 ring-[#0b1e2e]">
                <ScanLine size={13} strokeWidth={2.2} className="text-white" />
              </span>
            </div>
            <p className="text-[19px] font-extrabold tracking-tight text-white">카메라 접근</p>
            <p className="mt-1.5 text-center text-[13px] leading-relaxed text-white/45">
              실시간 물고기 측정을 위해<br />카메라 권한이 필요합니다
            </p>
          </div>

          <p className="px-6 py-3 text-center text-[12px] leading-relaxed text-white/32">
            다음 화면의 권한 팝업에서 <span className="font-semibold text-white/55">허용</span>을 눌러 주세요
          </p>

          <div className="space-y-2 px-4 pb-8 pt-1">
            <button
              type="button"
              onClick={() => { setCameraConsent(); setConsented(true); }}
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
            >
              카메라 허용하기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl py-2.5 text-[13px] font-medium text-white/28 transition-colors active:text-white/55"
            >
              나중에 하기
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
