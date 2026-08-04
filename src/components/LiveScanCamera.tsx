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
import { X, Camera, Loader2, RefreshCw, ScanLine, Check, RotateCw, AlertTriangle } from "lucide-react";
import { hasCameraConsent, setCameraConsent } from "./LiveMeasureCamera";
import { FishScanGlow } from "./FishScanGlow";
import { FishShimmer } from "./FishShimmer";
import type { ContourStatus } from "@/lib/fishContour";

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
    mmPerPixel: number;
    confidence: number;
    method: "ai-scan";
  };
  head: Point;
  tail: Point;
  /** 몸통 최대 너비 양 끝점 — 감지 실패 시 null */
  width: { top: Point; bottom: Point } | null;
  confidence: number;
};

type Props = {
  onConfirm: (result: LiveScanResult) => void; // "측정하기" — 결과 화면으로
  onClose: () => void;                          // X — 닫기
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

const POLL_INTERVAL_MS = 2000; // 스캔 폴링 주기
const SCAN_MAX_PX = 1024;      // 전송 프레임 최대 해상도 (속도/정확도 균형)
const REQ_TIMEOUT_MS = 9000;   // 개별 요청 하드 타임아웃
const CONFIDENCE_MIN = 0.7;    // 이 미만이면 실패 처리 (measure 페이지와 동일 기준)
const SHIMMER_MS = 1800;       // 윤슬(빛 포인트)이 물고기 외곽을 한 바퀴 도는 시간
// 물고기는 인식됐는데 기준물만 연속으로 못 잡은 횟수 — 이 횟수를 넘으면 안내 후 카메라 종료
// (AI 응답 한 번의 실수로 카메라가 닫히지 않도록 2회 연속을 요구)
const REF_MISS_LIMIT = 2;
const FISH_MISS_LIMIT = 2; // 물고기 연속 미감지 횟수 (REF_MISS_LIMIT 와 동일, 빠른 반응)
// "판정 불가" 응답(타임아웃·AI 오류·레이트리밋·파싱 실패·no-ai-key 등)이 연속으로
// 이 횟수만큼 쌓이면 물고기 미감지와 동일하게 안내 팝업을 띄운다.
// (판정 불가만 계속 오면 fishMiss/refMiss 카운터가 영원히 안 올라 팝업이 절대 안 뜨는 것 방지)
const TOTAL_FAIL_LIMIT = FISH_MISS_LIMIT * 3; // 6회 연속 (약 12초+)

type Cam = "loading" | "ready" | "error";

/**
 * 스캔 단계
 * - scan            : 물고기/기준물 탐색 중 (윤곽선은 그리지 않음)
 * - shimmer         : 물고기 + 기준물 모두 인식됨 → 윤슬 한 바퀴 후 자동 측정
 * - no-ref-warning  : 기준물 미감지 → "찾을 수 없습니다" 메시지 표시 (1.5초)
 * - ref-missing     : no-ref-warning 후 → "종료하시겠습니까?" 모달 표시
 * - no-fish-warning : 물고기 미감지 → "물고기를 찾을 수 없습니다" 메시지 표시 (1.5초)
 * - fish-missing    : no-fish-warning 후 → "종료하시겠습니까?" 모달 표시
 */
type Stage = "scan" | "shimmer" | "no-ref-warning" | "ref-missing" | "no-fish-warning" | "fish-missing";

type Detection = {
  ballN: NormBall;
  headN: Norm;
  tailN: Norm;
  widthN: { top: Norm; bottom: Norm } | null; // 몸통 최대 너비 (선택)
  confidence: number;
  lengthCm: number | null;
  widthCm: number | null;
};

/**
 * 입낚볼 노란 구체(sphere)만의 반지름을 정밀 측정한다.
 * AI가 반환한 볼 중심(cx, cy)에서 16방향으로 방사형 스캔해
 * 노란색(HSV H:20~70°, S>30%, V>20%) 픽셀이 이어지는 최대 반경을 구한다.
 * 검정 연결고리 등 비노란 영역은 자연스럽게 제외된다.
 *
 * @param canvas  캡처된 프레임 캔버스
 * @param cx      AI 감지 볼 중심 X (픽셀)
 * @param cy      AI 감지 볼 중심 Y (픽셀)
 * @param aiR     AI 감지 반경 (픽셀) — 실패 시 이 값을 그대로 반환
 * @returns       정제된 반경 (픽셀)
 */
function refineYellowBallRadius(
  canvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  aiR: number
): number {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return aiR;
    const w = canvas.width, h = canvas.height;
    // AI 반경의 1.5배 또는 캔버스 절반 중 작은 값까지 탐색
    const searchR = Math.min(aiR * 1.5, Math.min(w, h) / 2);

    // 탐색 영역만 ImageData 추출 (전체 캔버스보다 훨씬 빠름)
    const x0 = Math.max(0, Math.round(cx - searchR));
    const y0 = Math.max(0, Math.round(cy - searchR));
    const x1 = Math.min(w - 1, Math.round(cx + searchR));
    const y1 = Math.min(h - 1, Math.round(cy + searchR));
    const iw = x1 - x0 + 1, ih = y1 - y0 + 1;
    if (iw <= 0 || ih <= 0) return aiR;
    const imageData = ctx.getImageData(x0, y0, iw, ih);
    const px = imageData.data;

    /** 픽셀 (px, py) 가 노란색 범위인지 판별 (전역 캔버스 좌표) */
    function isYellow(gx: number, gy: number): boolean {
      const lx = Math.round(gx) - x0, ly = Math.round(gy) - y0;
      if (lx < 0 || ly < 0 || lx >= iw || ly >= ih) return false;
      const i = (ly * iw + lx) * 4;
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      if (max < 0.2 || delta < 0.08) return false;   // 너무 어둡거나 무채색
      const s = delta / max;
      if (s < 0.3) return false;                       // 채도 부족 (흰/회색)
      // Hue 계산
      let hue = 0;
      if (max === r)      hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else                hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
      // 노란색 범위 H: 20~70°
      return hue >= 20 && hue <= 70;
    }

    // 16방향 방사형 스캔 → 각 방향의 마지막 노란 픽셀 반경 수집
    const DIRS = 16;
    const radii: number[] = [];
    for (let d = 0; d < DIRS; d++) {
      const angle = (d / DIRS) * Math.PI * 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      let lastYellow = 0;
      for (let step = 2; step <= searchR; step += 1.5) {
        if (isYellow(cx + cos * step, cy + sin * step)) {
          lastYellow = step;
        } else if (step > lastYellow + 10) {
          break; // 10px 이상 연속 비노란 → 경계로 확정
        }
      }
      if (lastYellow > aiR * 0.3) radii.push(lastYellow);
    }

    if (radii.length < 6) return aiR; // 방향 데이터 불충분 → AI 값 유지

    // 중앙값으로 이상치 제거
    radii.sort((a, b) => a - b);
    const mid = Math.floor(radii.length / 2);
    const median = radii.length % 2 === 0
      ? (radii[mid - 1] + radii[mid]) / 2
      : radii[mid];

    // AI 반경의 55~110% 범위 내일 때만 적용 (극단적 오측 방어)
    if (median < aiR * 0.55 || median > aiR * 1.1) return aiR;
    return median;
  } catch {
    return aiR;
  }
}

export function LiveScanCamera({ onConfirm, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstScanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false); // 동시 요청 방지
  const abortRef = useRef<AbortController | null>(null);
  // 마지막 성공 프레임 + 정규화 감지 좌표 (측정하기 확정용)
  const successRef = useRef<{ work: HTMLCanvasElement; det: Detection } | null>(null);

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
  const refMissRef = useRef(0);  // 기준물 연속 미감지 횟수
  const fishMissRef = useRef(0); // 물고기 연속 미감지 횟수
  const totalFailRef = useRef(0); // "판정 불가" 응답(타임아웃·AI 오류 등) 연속 횟수

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

  /* ── 스트림/폴링 정리 (재사용) ── */
  const cleanupStream = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
    abortRef.current?.abort();
    abortRef.current = null;
    isScanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ── 기기 방향 감지: 자동회전 ON 상태에서 가로/세로 전환 시 UI 자동 동기화 ── */
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => {
      setBrowserIsLandscape(e.matches);
      // 기기 방향에 따라 UI 방향도 자동 맞춤
      setIsLandscape(e.matches);
    };
    mq.addEventListener("change", handler);
    // 초기 상태도 동기화
    if (mq.matches) setIsLandscape(true);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── 마운트 시 권한 상태 확인 → 이미 허용된 경우 커스텀 모달 스킵 ── */
  useEffect(() => {
    if (!hasCameraConsent()) return; // 동의 기록 없음 → 안내 모달 표시
    if (typeof navigator === "undefined") { setConsented(true); return; }
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((r) => { if (r.state === "granted") setConsented(true); })
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
    };
  }, []);

  /* ── 오버레이 렌더 (감지 좌표 → 프리뷰 좌표) ── */
  const drawOverlay = useCallback((d: Detection | null) => {
    const ov = overlayRef.current;
    const v = videoRef.current;
    if (!ov) return;
    const W = v?.videoWidth || ov.width;
    const H = v?.videoHeight || ov.height;
    if (!W || !H) return;
    if (ov.width !== W) ov.width = W;
    if (ov.height !== H) ov.height = H;
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!d) return;

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
    }
  }, []);

  useEffect(() => { drawOverlay(det); }, [det, videoHasData, drawOverlay]);

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
        frame.getContext("2d")!.drawImage(v, 0, 0, frame.width, frame.height);
        const dataUrl = frame.toDataURL("image/jpeg", 0.8);

        const controller = new AbortController();
        abortRef.current = controller;
        const to = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
        let data: any = null;
        try {
          const res = await fetch("/api/measure/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl, width: frame.width, height: frame.height }),
            signal: controller.signal,
          });
          if (res.ok) data = await res.json();
        } finally {
          clearTimeout(to);
          if (abortRef.current === controller) abortRef.current = null;
        }
        if (stopped) return;

        const ok =
          data?.ok &&
          data.ball && data.head && data.tail &&
          data.pose === "flat" &&
          typeof data.confidence === "number" &&
          data.confidence >= CONFIDENCE_MIN &&
          typeof data.ball.r === "number" && data.ball.r > 0;

        if (ok) {
          const w = frame.width, h = frame.height;
          // ── 노란 볼 구체만 정밀 측정 (검정 연결고리 제외) ──
          // AI가 감지한 반경을 기준으로, 클라이언트 픽셀 분석으로 노란색 경계를 재측정.
          // 실패 시(조명·과노출 등) AI 반경을 그대로 사용해 기존 동작 유지.
          const aiRadiusPx = data.ball.r * w;
          const refinedRadiusPx = refineYellowBallRadius(
            frame, data.ball.x * w, data.ball.y * h, aiRadiusPx
          );
          const diameterPx = 2 * refinedRadiusPx;
          const widthN =
            data.width?.top && data.width?.bottom
              ? { top: data.width.top as Norm, bottom: data.width.bottom as Norm }
              : null;
          let lengthCm: number | null = null;
          let widthCm: number | null = null;
          if (diameterPx > 0) {
            const mmPerPixel = 40 / diameterPx; // 입낚볼 실지름 40mm
            const hx = data.head.x * w, hy = data.head.y * h;
            const tx = data.tail.x * w, ty = data.tail.y * h;
            const px = Math.hypot(tx - hx, ty - hy);
            lengthCm = Math.round((px * mmPerPixel) / 10 * 10) / 10; // cm, 소수 1자리
            if (widthN) {
              const wpx = Math.hypot(
                (widthN.bottom.x - widthN.top.x) * w,
                (widthN.bottom.y - widthN.top.y) * h,
              );
              widthCm = wpx > 0 ? Math.round((wpx * mmPerPixel) / 10 * 10) / 10 : null;
            }
          }
          const detection: Detection = {
            ballN: { x: data.ball.x, y: data.ball.y, r: refinedRadiusPx / w },
            headN: { x: data.head.x, y: data.head.y },
            tailN: { x: data.tail.x, y: data.tail.y },
            widthN,
            confidence: data.confidence,
            lengthCm,
            widthCm,
          };
          successRef.current = { work: frame, det: detection };
          refMissRef.current = 0;
          totalFailRef.current = 0;
          setDet(detection);
          // 물고기 + 기준물 모두 인식 → 윤슬 한 바퀴 후 자동 측정
          goStage("shimmer");
        } else {
          // 실패/인식 안 됨 → 오버레이 제거 (스펙: 카메라 화면만 유지)
          successRef.current = null;
          setDet(null);
          if (data?.ok === false && data?.reason === "no-ball") {
            totalFailRef.current = 0; // 확정 판정 수신 → 판정 불가 연속 카운터 리셋
            // 기준물(입낚볼·입낚키링·인쇄 기준물) 미감지 —
            // API 가 fishFound:false 이고 ballFound:false ("아무것도 없음") 인 경우:
            //   → 클라이언트 윤곽 감지(scanStatus "locked") 를 무시하고 물고기 미감지로 처리.
            //     (윤곽 감지는 사람 다리/의류 등을 물고기로 오인식할 수 있음)
            // API 가 fishFound:true 이거나 윤곽 감지가 locked 인 경우만 "물고기는 있음"으로 판단.
            const bothAbsent = data?.ballFound === false && data?.fishFound === false;
            const fishVisible =
              data?.fishFound === true ||
              (!bothAbsent && scanStatusRef.current === "locked");
            if (fishVisible) {
              fishMissRef.current = 0; // 물고기는 있으므로 물고기 카운터 리셋
              refMissRef.current += 1;
              if (refMissRef.current >= REF_MISS_LIMIT) goStage("no-ref-warning");
            } else {
              // 물고기도 기준물도 없음(또는 물고기 자체가 없음) → 물고기 미감지 카운터 증가
              refMissRef.current = 0;
              fishMissRef.current += 1;
              if (fishMissRef.current >= FISH_MISS_LIMIT) goStage("no-fish-warning");
            }
          } else if (data?.ok === false && data?.reason === "no-fish") {
            // 물고기 자체가 없음
            totalFailRef.current = 0; // 확정 판정 수신 → 판정 불가 연속 카운터 리셋
            refMissRef.current = 0;
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
  }, [camStatus, videoHasData, stage, goStage]);

  /* ── "측정하기": 마지막 성공 프레임 확정 → 부모로 ── */
  const confirm = useCallback(() => {
    const s = successRef.current;
    if (!s) return;
    cleanupStream();
    const w = s.work.width, h = s.work.height;
    const diameterPx = 2 * s.det.ballN.r * w;
    if (!(diameterPx > 0)) { onClose(); return; }
    const result: LiveScanResult = {
      work: s.work,
      ball: {
        found: true,
        centerX: s.det.ballN.x * w,
        centerY: s.det.ballN.y * h,
        diameterPx,
        mmPerPixel: 40 / diameterPx,
        confidence: s.det.confidence,
        method: "ai-scan",
      },
      head: { x: s.det.headN.x * w, y: s.det.headN.y * h },
      tail: { x: s.det.tailN.x * w, y: s.det.tailN.y * h },
      width: s.det.widthN
        ? {
            top: { x: s.det.widthN.top.x * w, y: s.det.widthN.top.y * h },
            bottom: { x: s.det.widthN.bottom.x * w, y: s.det.widthN.bottom.y * h },
          }
        : null,
      confidence: s.det.confidence,
    };
    onConfirm(result);
  }, [cleanupStream, onConfirm, onClose]);

  /* ── 윤슬 한 바퀴 완료 → 자동으로 측정 확정 ── */
  const handleShimmerComplete = useCallback(() => { confirm(); }, [confirm]);

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

  /* ── 기준물 미감지 안내 '예' → 카메라 닫고 선택 화면 복귀 ── */
  const closeAfterRefMissing = useCallback(() => {
    cleanupStream();
    onClose();
  }, [cleanupStream, onClose]);

  /* ── 기준물 미감지 안내 '아니오' → 팝업만 닫고 카메라 유지 (미감지 카운터 리셋) ── */
  const keepScanningAfterRefMissing = useCallback(() => {
    refMissRef.current = 0;
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
    fishMissRef.current = 0;
    totalFailRef.current = 0;
    goStage("scan");
  }, [goStage]);

  // effectiveLandscape: 실제로 가로 UI를 표시할지 여부
  const effectiveLandscape = isLandscape || browserIsLandscape;
  // needsCssRotation: CSS rotate(90deg) 트릭이 필요한 경우
  const needsCssRotation = effectiveLandscape && !browserIsLandscape;

  const canConfirm = !!det;

  /* ── 윤곽 감지 상태별 안내 문구 ── */
  const scanGuide: { main: string; sub: string; locked: boolean } =
    scanStatus === "locked"
      ? { main: "물고기 윤곽 인식됨 · 측정 중...", sub: "입낚볼과 함께 촬영해 주세요", locked: true }
      : scanStatus === "too-small"
      ? { main: "물고기가 너무 작게 보여요", sub: "조금 더 가까이에서 비춰주세요", locked: false }
      : scanStatus === "too-large"
      ? { main: "물고기가 화면에 꽉 찼어요", sub: "조금 더 멀리서 비춰주세요", locked: false }
      : { main: "물고기를 화면 중앙에 놓아주세요", sub: "바닥에 옆으로 눕히고 입낚볼도 함께 보이게 맞춰주세요", locked: false };

  /* ── 안내 문구 본문 (세로/가로 공용) — 단계별로 하나만 렌더 ── */
  const guidanceBody = stage === "shimmer" ? (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-yellow-300">
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

  /* ── 측정하기 버튼 (세로 모드 — 원형, 노란색 반투명) ── */
  const measureButton = (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={confirm}
        disabled={!canConfirm}
        className={
          "flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-full text-[11px] font-bold transition-all active:scale-[0.94] " +
          (canConfirm
            ? "bg-yellow-400/80 text-white shadow-lg shadow-yellow-400/40"
            : "bg-yellow-400/15 text-yellow-100/35")
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
      <canvas
        ref={overlayRef}
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10 }}
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
      <FishShimmer
        active={stage === "shimmer"}
        sourceRef={videoRef}
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

    {/* ── UI 오버레이 컨테이너 (z-400, 투명 배경) — CSS 회전 모드일 때 rotate(90deg) 적용 ── */}
    <div
      className={!needsCssRotation ? "fixed inset-0 z-[400] overflow-hidden" : undefined}
      style={needsCssRotation ? { ...outerStyle, backgroundColor: "transparent" } : undefined}
    >
      {/* ── 상단 바 ── */}
      <div
        className={
          "absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent py-3 " +
          (!effectiveLandscape ? "pt-safe px-4" : "pr-4")
        }
        style={effectiveLandscape ? {
          right: "calc(88px + max(env(safe-area-inset-bottom, 0px), env(safe-area-inset-right, 0px)))",
          // CSS 회전 모드: LOCAL left = 노치 방향 → safe-area-inset-top
          // 네이티브 가로 모드: 왼쪽 = 노치 방향 → safe-area-inset-left
          // 둘 다 max()로 대응
          paddingLeft: "max(20px, env(safe-area-inset-top), env(safe-area-inset-left))",
        } : undefined}
      >
        <div className="flex items-center gap-2">
          <ScanLine size={17} strokeWidth={1.9} className="text-orange-400" />
          <span className="text-[14px] font-bold text-white">AI 실시간 스캐너</span>
          <span className="animate-pulse rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400 ring-1 ring-orange-500/30">
            입낚 AI 측정 중
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 세로/가로 전환 버튼 — 기기가 자동회전 중이면 숨김 (기기 방향이 자동으로 제어) */}
          {!browserIsLandscape && (
            <button
              type="button"
              onClick={() => setIsLandscape((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20"
            >
              <RotateCw size={12} strokeWidth={2} />
              {effectiveLandscape ? "세로로" : "가로로"}
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

      {/* ── 화면 중앙 안내 문구 — scan 탐색 중 + 카메라 준비 완료 시만 표시 ── */}
      {stage === "scan" && camStatus === "ready" && videoHasData && !canConfirm && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1"
          style={{ top: "50%", transform: "translateY(-50%)", animation: "slowBlink 2.8s ease-in-out infinite" }}
        >
          <p
            className="text-[15px] font-bold tracking-tight text-white"
            style={{ textShadow: "0 0 12px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.9)" }}
          >
            물고기와 입낚볼을 함께 비춰주세요
          </p>
          <p
            className="text-[11px] text-white/65"
            style={{ textShadow: "0 0 8px rgba(0,0,0,0.9)" }}
          >
            AI가 자동으로 인식합니다
          </p>
        </div>
      )}

      {/* 감지 시 상단 배지 */}
      {canConfirm && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2">
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-3 py-1.5 text-[12px] font-bold text-white shadow-lg">
            <Check size={14} strokeWidth={2.6} />
            물고기 인식됨
            {det?.lengthCm != null && <span className="ml-0.5">· 약 {det.lengthCm}cm</span>}
            {det?.widthCm != null && <span className="ml-0.5">· 폭 {det.widthCm}cm</span>}
          </span>
        </div>
      )}

      {camStatus === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 size={30} className="animate-spin text-orange-400" />
          <p className="text-[13px]">카메라 준비 중...</p>
        </div>
      )}

      {camStatus === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/85">{camError}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setRetry((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600"
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

      {/* ── 하단 컨트롤 (세로 모드) ── */}
      {camStatus !== "error" && !effectiveLandscape && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-5 pt-10">
          {/* scan 탐색 중에는 중앙 깜빡이는 흰 글씨가 안내 대신하므로 카드 숨김 */}
          {(stage !== "scan" || canConfirm) && <div className="mb-3">{guidance}</div>}
          {measureButton}
        </div>
      )}

      {/* ── 안내 오버레이 — 가로 모드 시 카메라 왼쪽 영역 중앙 ── */}
      {camStatus !== "error" && effectiveLandscape && (stage !== "scan" || canConfirm) && (
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
      {camStatus !== "error" && effectiveLandscape && (
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
          {/* 측정하기 (원형, 노란색 반투명) */}
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={
              "flex h-[60px] w-[60px] flex-col items-center justify-center gap-1 rounded-full text-[10px] font-bold transition-all active:scale-[0.94] " +
              (canConfirm
                ? "bg-yellow-400/80 text-white shadow-lg shadow-yellow-400/40"
                : "bg-yellow-400/15 text-yellow-100/35")
            }
          >
            <ScanLine size={19} strokeWidth={2} />
            <span>측정하기</span>
          </button>
          <div className="flex-[2]" />
        </div>
      )}

    </div>

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
              입낚볼 / 입낚키링 /<br />입낚인쇄물을 찾을 수 없습니다
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
              물고기가 인식되지 않았어요
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
              className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
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
              입낚볼 / 입낚키링 / 입낚인쇄물이<br />인식되지 않았어요
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
              className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
            >
              예
            </button>
          </div>
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
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
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
