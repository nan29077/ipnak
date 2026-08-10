/**
 * YOLO 온디바이스 추론 — 공용 타입
 *
 * 입낚 AI 카메라(측정 화면)에서 물고기·기준물(입낚볼/입낚키링)을 브라우저에서 직접
 * 감지하기 위한 타입 정의. 실제 추론은 onnxruntime-web(WASM)으로 수행한다.
 *
 * ⚠️ 이 모듈은 순수 타입/상수만 담는다 — onnxruntime-web 을 import 하지 않으므로
 *    서버 컴포넌트에서 참조해도 안전하다.
 */

/** 학습 클래스 — 이 순서가 곧 YOLO class id (0,1,2) 이므로 절대 순서를 바꾸지 말 것 */
export const YOLO_CLASSES = ["fish", "ipnak-ball", "ipnak-keyring"] as const;

export type YoloClassName = (typeof YOLO_CLASSES)[number];

/** 관리자 라벨링 UI·오버레이에 쓰는 한글 표기 */
export const YOLO_CLASS_LABEL: Record<YoloClassName, string> = {
  fish: "물고기",
  "ipnak-ball": "입낚볼",
  "ipnak-keyring": "입낚키링",
};

/** 오버레이 박스 색상 — 물고기는 초록, 기준물은 노랑 (측정 화면 기존 색과 통일) */
export const YOLO_CLASS_COLOR: Record<YoloClassName, string> = {
  fish: "#22c55e",
  "ipnak-ball": "#eab308",
  "ipnak-keyring": "#eab308",
};

/** 기준물(크기 환산 기준) 클래스 — 실지름 40mm */
export const REFERENCE_CLASSES: YoloClassName[] = ["ipnak-ball", "ipnak-keyring"];

/** 입낚볼·입낚키링 실지름(mm) — 측정 화면의 기존 상수와 동일 */
export const REFERENCE_DIAMETER_MM = 40;

/** 감지 박스 (원본 이미지 픽셀 좌표, x/y 는 좌상단) */
export interface BoxPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 감지 박스 (0~1 정규화 좌표, x/y 는 좌상단) */
export interface BoxNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 단일 감지 결과 */
export interface Detection {
  /** YOLO class id (YOLO_CLASSES 인덱스) */
  classId: number;
  /** class id 를 매핑한 클래스 이름. 모델이 학습하지 않은 id 면 null */
  className: YoloClassName | null;
  /** 신뢰도 0~1 */
  score: number;
  /** 원본 이미지 픽셀 기준 박스 */
  box: BoxPx;
  /** 0~1 정규화 박스 (오버레이 렌더링용) */
  boxN: BoxNorm;
}

/** 한 프레임 추론 결과 */
export interface YoloResult {
  /** NMS 까지 끝난 최종 감지 목록 (score 내림차순) */
  detections: Detection[];
  /** 추론에 걸린 시간(ms) — 성능 튜닝/디버깅용 */
  inferenceMs: number;
  /** 모델 입력 정사각 해상도 (기본 640) */
  inputSize: number;
  /** 추론에 사용한 원본 프레임 크기 */
  sourceWidth: number;
  sourceHeight: number;
}

/** 모델 로드·추론 설정 */
export interface ModelConfig {
  /** .onnx 파일 URL. 기본 /api/models/best.onnx (standalone 빌드에서도 서빙되는 경로) */
  modelUrl: string;
  /** 모델 입력 정사각 크기 (YOLOv8 기본 640) */
  inputSize: number;
  /** 이 점수 미만 박스는 버린다 */
  scoreThreshold: number;
  /** NMS IoU 임계값 */
  iouThreshold: number;
  /** 한 프레임에서 남길 최대 박스 수 */
  maxDetections: number;
  /** class id → 이름 매핑 (기본 YOLO_CLASSES) */
  classNames: readonly string[];
  /** onnxruntime 실행 백엔드 우선순위 */
  executionProviders: string[];
  /**
   * onnxruntime-web 런타임 파일(진입 .mjs + .wasm)이 있는 기본 경로.
   * 지정하지 않으면 `/ort/` → (없으면) jsDelivr CDN 순으로 자동 선택한다.
   * 환경변수 NEXT_PUBLIC_ORT_BASE 로 덮어쓸 수 있다.
   */
  wasmPath?: string;
}

/** 레터박스 전처리 결과 — 후처리에서 원본 좌표로 되돌릴 때 필요 */
export interface LetterboxInfo {
  /** 원본 → 입력 크기 축소 배율 */
  scale: number;
  /** 좌우 여백(px, 입력 이미지 기준) */
  padX: number;
  /** 상하 여백(px, 입력 이미지 기준) */
  padY: number;
  /** 모델 입력 정사각 크기 */
  inputSize: number;
  /** 원본 프레임 크기 */
  sourceWidth: number;
  sourceHeight: number;
}

/** 전처리 산출물 */
export interface PreprocessResult {
  /** NCHW(1,3,inputSize,inputSize) RGB, 0~1 정규화 */
  data: Float32Array;
  /** 텐서 shape */
  dims: [number, number, number, number];
  info: LetterboxInfo;
}

/** 기준물 대비 물고기 크기 환산 결과 */
export interface SizeEstimate {
  /** 물고기 전장 추정치(cm) */
  lengthCm: number;
  /** 물고기 체고(세로) 추정치(cm) */
  heightCm: number;
  /** 1픽셀당 mm */
  mmPerPixel: number;
  /** 환산 기준이 된 기준물 클래스 */
  referenceClass: YoloClassName;
}
