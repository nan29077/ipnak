"use client";
/**
 * 윤슬(빛 포인트) 트레이스 애니메이션
 *
 * - 감지된 물고기 외곽선(`@/lib/fishContour`)을 따라 빛 포인트가 한 방향으로 "한 바퀴" 돈다
 * - 포인트 뒤로는 잔광(윤슬)이 남았다가 서서히 사라진다 — 지나간 자리만 빛나고, 앞쪽 윤곽은 보이지 않는다
 * - 한 바퀴가 끝나면 onComplete() 를 딱 한 번 호출한다 → 부모가 측정(길이·무게)을 진행
 * - 윤곽을 끝내 못 잡아도 FALLBACK_MS 안에 onComplete 이 호출된다 (측정 흐름이 멈추지 않도록)
 *
 * 좌표계는 FishScanGlow 와 동일하다 — 원본(video/canvas) 정규화 좌표를 object-fit 규칙으로 오버레이에 정합.
 */
import { useEffect, useRef } from "react";
import { FishContourDetector, type Pt } from "@/lib/fishContour";

type SourceEl = HTMLVideoElement | HTMLCanvasElement | null;

type Props = {
  active: boolean;
  /** 윤곽을 추출할 원본 (카메라 video 또는 캡처 canvas) */
  sourceRef?: React.RefObject<SourceEl>;
  /** 원본이 오버레이 박스를 채우는 방식 — 좌표 정합용 */
  objectFit?: "cover" | "contain" | "fill";
  /** 한 바퀴 도는 시간 (ms) */
  durationMs?: number;
  /** 한 바퀴 완료 시 1회 호출 */
  onComplete?: () => void;
  className?: string;
};

const DETECT_INTERVAL_MS = 90;   // 윤곽 재감지 주기 (달리는 동안에도 윤곽을 따라붙게)
const AFTERGLOW_MS = 620;        // 잔광이 완전히 사라지기까지의 시간
const TAIL_DOTS = 18;            // 포인트 뒤에 따라붙는 꼬리 점 개수
const TAIL_SPAN = 0.055;         // 꼬리 점이 차지하는 경로 비율
const HEAD_R = 5;                // 선두 포인트 반경 (CSS px)
const FALLBACK_MS = 3200;        // 윤곽 미확보 시에도 이 시간 안에는 반드시 완료
const DEFAULT_DURATION = 1800;   // 한 바퀴 기본 소요 시간

/** 소스 엘리먼트의 실제 픽셀 크기 (video는 videoWidth/Height) */
function sourceSize(el: SourceEl): { w: number; h: number } | null {
  if (!el) return null;
  if (el instanceof HTMLVideoElement) {
    if (el.readyState < 2 || !el.videoWidth || !el.videoHeight) return null;
    return { w: el.videoWidth, h: el.videoHeight };
  }
  if (!el.width || !el.height) return null;
  return { w: el.width, h: el.height };
}

export function FishShimmer({
  active,
  sourceRef,
  objectFit = "cover",
  durationMs = DEFAULT_DURATION,
  onComplete,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // 최신 props 를 rAF 루프에서 참조 (루프 재시작 없이 반영)
  const sourceRefRef = useRef(sourceRef);
  sourceRefRef.current = sourceRef;
  const fitRef = useRef(objectFit);
  fitRef.current = objectFit;
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const detector = new FishContourDetector();
    const mounted = performance.now();
    let stopped = false;
    let done = false;

    // 검출 결과 (정규화 좌표) + 원본 프레임 크기
    let contour: Pt[] = [];
    let srcW = 0;
    let srcH = 0;
    let lastDetect = -Infinity;
    // 윤곽을 처음 확보한 시각 — 여기서부터 한 바퀴를 센다
    let runStart: number | null = null;

    const finish = () => {
      if (done) return;
      done = true;
      onCompleteRef.current?.();
    };

    const frame = (now: number) => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(frame);

      const box = canvas.parentElement;
      const cssW = box?.clientWidth || canvas.clientWidth || 320;
      const cssH = box?.clientHeight || canvas.clientHeight || 240;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      /* ── ① 윤곽 갱신 — 확보에 실패해도 마지막 윤곽을 유지한다 ── */
      if (now - lastDetect >= DETECT_INTERVAL_MS) {
        lastDetect = now;
        const el = sourceRefRef.current?.current ?? null;
        const size = sourceSize(el);
        if (size) {
          const res = detector.detect(el, size.w, size.h);
          if (res.status === "locked" && res.points.length >= 12) {
            srcW = size.w;
            srcH = size.h;
            contour = res.points;
            if (runStart == null) runStart = now;
          }
        }
      }

      /* ── ② 윤곽 미확보 — 안전장치 시간 안에는 완료 처리 ── */
      if (runStart == null || contour.length < 12) {
        if (now - mounted >= FALLBACK_MS) finish();
        return;
      }

      /* ── ③ 정규화 좌표 → 오버레이 캔버스 좌표 (object-fit 정합) ── */
      let sx = w;
      let sy = h;
      let ox = 0;
      let oy = 0;
      if (srcW > 0 && srcH > 0 && fitRef.current !== "fill") {
        const s =
          fitRef.current === "cover"
            ? Math.max(w / srcW, h / srcH)
            : Math.min(w / srcW, h / srcH);
        sx = srcW * s;
        sy = srcH * s;
        ox = (w - sx) / 2;
        oy = (h - sy) / 2;
      }
      const pts = contour.map((p) => ({ x: ox + p.x * sx, y: oy + p.y * sy }));

      /* ── ④ 한 바퀴 진행도 (0~1) ── */
      const dur = Math.max(300, durationRef.current);
      const progress = Math.min(1, (now - runStart) / dur);
      drawShimmer(ctx, pts, progress, dur, dpr);

      // 한 바퀴 완료 → 측정 진행
      if (progress >= 1 || now - mounted >= FALLBACK_MS) finish();
    };

    frame(mounted); // 첫 프레임 즉시 렌더

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      detector.dispose();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className={"pointer-events-none absolute inset-0 z-20 " + (className ?? "")}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
    </div>
  );
}

/* ── 그리기 ────────────────────────────────────────────────── */

/**
 * 윤곽선을 따라 도는 빛 포인트 + 잔광(윤슬)
 * @param progress 0~1 (한 바퀴)
 * @param dur      한 바퀴 소요 시간 (ms) — 잔광 길이를 경로 비율로 환산할 때 사용
 * @param dpr      기기 픽셀 비율 — 점 반경을 CSS px 기준으로 맞추기 위함
 */
function drawShimmer(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  progress: number,
  dur: number,
  dpr: number,
) {
  const n = pts.length;

  // 경로 누적 길이 (경로 비율 → 좌표 샘플링용)
  const acc = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    acc[i + 1] = acc[i] + Math.hypot(q.x - p.x, q.y - p.y);
  }
  const total = acc[n];
  if (!(total > 0)) return;

  /** 경로 비율 u(0~1) 위치의 캔버스 좌표 (0 미만은 시작점으로 클램프 — 시작 전 구간은 그리지 않는다) */
  const pointAt = (u: number) => {
    const target = Math.max(0, Math.min(1, u)) * total;
    let i = 1;
    while (i < n && acc[i] < target) i++;
    const s0 = acc[i - 1];
    const segLen = acc[i] - s0 || 1;
    const r = (target - s0) / segLen;
    const a = pts[i - 1];
    const b = pts[i % n];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  };

  const headR = HEAD_R * dpr;
  // 잔광이 남는 길이 (경로 비율) — 지나온 구간을 넘지 않는다
  const wake = Math.min(progress, AFTERGLOW_MS / dur);

  /* ① 잔광 — 지나온 자리에 남아 서서히 옅어지는 윤슬 */
  if (wake > 0) {
    const SEGS = 44;
    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 120, 0.85)";
    for (let i = 0; i < SEGS; i++) {
      const f0 = i / SEGS;         // 0 = 포인트 바로 뒤, 1 = 잔광 끝
      const f1 = (i + 1) / SEGS;
      const a = Math.pow(1 - f0, 2.2); // 뒤로 갈수록 급격히 옅어짐
      if (a < 0.02) continue;
      const p0 = pointAt(progress - wake * f0);
      const p1 = pointAt(progress - wake * f1);
      ctx.strokeStyle = `rgba(255, 236, 178, ${a * 0.55})`;
      ctx.lineWidth = headR * (0.35 + 0.75 * a);
      ctx.shadowBlur = headR * 2.2 * a;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ② 꼬리 점 — 포인트 뒤를 따라붙는 작은 빛 알갱이들 */
  ctx.save();
  ctx.shadowColor = "rgba(255, 220, 100, 0.95)";
  for (let i = TAIL_DOTS; i >= 1; i--) {
    const f = i / TAIL_DOTS;              // 1 = 가장 뒤
    const u = progress - TAIL_SPAN * f;
    if (u < 0) continue;
    const a = Math.pow(1 - f, 1.5);       // 뒤로 갈수록 alpha 감소
    if (a < 0.03) continue;
    const c = pointAt(u);
    const r = headR * (0.35 + 0.55 * a);
    ctx.globalAlpha = a * 0.9;
    ctx.shadowBlur = r * 2.6;
    ctx.fillStyle = "rgba(255, 220, 100, 1)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* ③ 선두 포인트 — 금빛 글로우 + 흰 코어 */
  const head = pointAt(progress);
  ctx.save();
  ctx.shadowColor = "rgba(255, 220, 100, 1)";
  ctx.shadowBlur = headR * 4.5;
  ctx.fillStyle = "rgba(255, 220, 100, 1)";
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = headR * 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default FishShimmer;
