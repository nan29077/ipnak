"use client";
/**
 * 실시간 물고기 윤곽 스캔 오버레이
 *
 * - 카메라(video) 또는 캡처 프레임(canvas)을 매 틱 분석해 실제 물고기 외곽선을 추출한다
 *   (검출 로직: `@/lib/fishContour` — 순수 Canvas API, 외부 라이브러리 없음)
 * - 추출된 윤곽선 위에:
 *     ① 은은한 하늘색 베이스 글로우
 *     ② dash offset 이 흐르는 점선
 *     ③ 윤곽을 한 바퀴 도는 혜성형 글로우 선
 *     ④ 랜덤하게 반짝이는 별/다이아몬드 파티클
 * - 윤곽을 못 찾은 동안에는 중앙 배치 가이드(코너 브라켓) + 스캔 스윕 라인만 표시
 * - 감지 상태는 onStatusChange 로 부모에 전달 → 부모가 상황별 안내 문구를 배치
 * - requestAnimationFrame 기반, active=false 면 즉시 정지·정리
 */
import { useEffect, useRef } from "react";
import { ScanLine } from "lucide-react";
import { FishContourDetector, type ContourStatus, type Pt } from "@/lib/fishContour";

type SourceEl = HTMLVideoElement | HTMLCanvasElement | null;

type Props = {
  active: boolean;
  /** 윤곽을 추출할 원본 (카메라 video 또는 캡처 canvas) */
  sourceRef?: React.RefObject<SourceEl>;
  /** 원본이 오버레이 박스를 채우는 방식 — 좌표 정합용 (video의 object-fit 과 동일하게) */
  objectFit?: "cover" | "contain" | "fill";
  /** 하단 안내 문구. null 이면 칩 자체를 표시하지 않음 */
  label?: string | null;
  /** 감지 상태 변화 알림 (안내 문구를 부모 레이어에 배치할 때 사용) */
  onStatusChange?: (status: ContourStatus) => void;
  className?: string;
};

const DETECT_INTERVAL_MS = 70;   // 윤곽 재감지 주기 (약 14fps — 그리기는 매 rAF)
const SPARKLE_COUNT = 14;        // 윤곽 위에서 반짝이는 파티클 개수
const RUN_PERIOD_MS = 2600;      // 글로우 선이 윤곽 한 바퀴 도는 시간
const RUN_SPAN = 0.13;           // 달리는 글로우 구간 길이 (경로 비율)
const DASH_PERIOD_MS = 1800;     // 점선 흐름 주기
const SWEEP_PERIOD_MS = 2200;    // 미감지 시 스윕 라인 주기
const LOST_GRACE_MS = 450;       // 순간적 미검출에도 윤곽을 잠깐 유지 (깜빡임 방지)

/** 시드 기반 의사난수 — 파티클 위치·주기를 매 프레임마다 흔들지 않기 위해 사용 */
function seeded(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

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

export function FishScanGlow({
  active,
  sourceRef,
  objectFit = "cover",
  label = "스캔 중...",
  onStatusChange,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // 최신 props 를 rAF 루프에서 참조 (루프 재시작 없이 반영)
  const sourceRefRef = useRef(sourceRef);
  sourceRefRef.current = sourceRef;
  const fitRef = useRef(objectFit);
  fitRef.current = objectFit;
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const detector = new FishContourDetector();
    const start = performance.now();
    let stopped = false;

    // 검출 결과 (정규화 좌표) + 원본 프레임 크기
    let contour: Pt[] = [];
    let contourAt = 0;
    let srcW = 0;
    let srcH = 0;
    let lastDetect = -Infinity;
    let status: ContourStatus = "idle";

    const emit = (next: ContourStatus) => {
      if (next === status) return;
      status = next;
      onStatusRef.current?.(next);
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

      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      /* ── ① 윤곽 재감지 (그리기보다 낮은 주기) ── */
      if (now - lastDetect >= DETECT_INTERVAL_MS) {
        lastDetect = now;
        const el = sourceRefRef.current?.current ?? null;
        const size = sourceSize(el);
        if (!size) {
          emit("idle");
          contour = [];
        } else {
          srcW = size.w;
          srcH = size.h;
          const res = detector.detect(el, size.w, size.h);
          emit(res.status);
          if (res.status === "locked" && res.points.length >= 12) {
            contour = res.points;
            contourAt = now;
          } else if (now - contourAt > LOST_GRACE_MS) {
            contour = [];
          }
        }
      }

      /* ── ② 정규화 좌표 → 오버레이 캔버스 좌표 (object-fit 정합) ── */
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
      const toCanvas = (p: Pt) => ({ x: ox + p.x * sx, y: oy + p.y * sy });

      if (contour.length >= 12) drawContourGlow(ctx, contour.map(toCanvas), t);
      else drawSearchGuide(ctx, w, h, t);
    };

    frame(start); // 첫 프레임은 즉시 렌더 (rAF 대기 없이 표시) — 이후 자체적으로 루프

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      detector.dispose();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  // 비활성화 시 상태 초기화 알림 (부모 안내 문구가 남지 않도록)
  useEffect(() => {
    if (!active) onStatusRef.current?.("idle");
  }, [active]);

  if (!active) return null;

  return (
    <div className={"pointer-events-none absolute inset-0 z-20 " + (className ?? "")}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
      {label && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <span
            className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-bold text-sky-100 ring-1 ring-sky-300/30 backdrop-blur-[2px]"
            style={{ animation: "fishScanPulse 1.6s ease-in-out infinite" }}
          >
            <ScanLine size={14} strokeWidth={2} className="text-sky-300" />
            {label}
          </span>
        </div>
      )}
      <style>{`@keyframes fishScanPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
    </div>
  );
}

/* ── 그리기 ────────────────────────────────────────────────── */

/** 감지된 윤곽선 위에 글로우 + 점선 흐름 + 혜성 + 파티클 */
function drawContourGlow(ctx: CanvasRenderingContext2D, pts: Pt[], t: number) {
  const n = pts.length;

  // 경로 누적 길이 (경로 비율 → 좌표 샘플링용) + 바운딩 박스
  const acc = new Float64Array(n + 1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    const q = pts[(i + 1) % n];
    acc[i + 1] = acc[i] + Math.hypot(q.x - p.x, q.y - p.y);
  }
  const total = acc[n];
  if (!(total > 0)) return;

  const span = Math.max(maxX - minX, maxY - minY);
  const stroke = Math.max(1.5, span * 0.008);

  /** 경로 비율 u(0~1) 위치의 캔버스 좌표 */
  const pointAt = (u: number) => {
    const target = (((u % 1) + 1) % 1) * total;
    let i = 1;
    while (i < n && acc[i] < target) i++;
    const s0 = acc[i - 1];
    const segLen = acc[i] - s0 || 1;
    const r = (target - s0) / segLen;
    const a = pts[i - 1];
    const b = pts[i % n];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  };

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  };

  // ① 베이스 글로우 (은은한 하늘색 외곽)
  ctx.save();
  ctx.shadowColor = "rgba(125, 211, 252, 0.9)";
  ctx.shadowBlur = Math.max(8, span * 0.05);
  ctx.strokeStyle = "rgba(186, 230, 253, 0.35)";
  ctx.lineWidth = stroke * 1.4;
  tracePath();
  ctx.stroke();
  ctx.restore();

  // ② 점선 흐름 (dash offset 애니메이션)
  ctx.save();
  const dash = Math.max(6, span * 0.035);
  ctx.setLineDash([dash, dash * 0.85]);
  ctx.lineDashOffset = -((t % DASH_PERIOD_MS) / DASH_PERIOD_MS) * (dash * 1.85) * 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = stroke;
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = Math.max(4, span * 0.02);
  tracePath();
  ctx.stroke();
  ctx.restore();

  // ③ 윤곽을 따라 달리는 혜성형 글로우 선
  const runT = (t % RUN_PERIOD_MS) / RUN_PERIOD_MS;
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  ctx.shadowBlur = Math.max(14, span * 0.09);
  ctx.lineWidth = stroke * 1.9;
  const SEGMENTS = 22;
  for (let i = 0; i < SEGMENTS; i++) {
    const f0 = i / SEGMENTS;
    const f1 = (i + 1) / SEGMENTS;
    const p0 = pointAt(runT + f0 * RUN_SPAN);
    const p1 = pointAt(runT + f1 * RUN_SPAN);
    // 꼬리쪽으로 갈수록 옅어지는 혜성 꼬리
    const alpha = Math.pow(f0, 1.6);
    ctx.strokeStyle = `rgba(${Math.round(224 + 31 * alpha)}, ${Math.round(242 + 13 * alpha)}, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();

  // ④ 윤곽 위 반짝이는 별/다이아몬드 파티클
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const period = 900 + seeded(i + 51) * 1400;
    const phase = seeded(i + 97);
    const cycle = ((t / period + phase) % 1 + 1) % 1;
    const opacity = Math.pow(Math.sin(Math.PI * cycle), 2); // 0 → 1 → 0
    if (opacity < 0.03) continue;
    const c = pointAt(seeded(i));
    const size = span * 0.016 * (0.6 + seeded(i + 13) * 0.9) * (0.5 + opacity * 0.7);
    const isStar = i % 3 !== 0; // 2/3 는 4각 별, 1/3 은 다이아몬드
    const rot = seeded(i + 29) * Math.PI;

    ctx.globalAlpha = opacity;
    ctx.shadowBlur = size * 3;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#bae6fd";
    ctx.beginPath();
    if (isStar) {
      // 4각 별 (오목한 변)
      for (let k = 0; k < 8; k++) {
        const r = k % 2 === 0 ? size : size * 0.32;
        const th = rot + (Math.PI / 4) * k;
        const px = c.x + Math.cos(th) * r;
        const py = c.y + Math.sin(th) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    } else {
      // 다이아몬드
      for (let k = 0; k < 4; k++) {
        const th = rot + (Math.PI / 2) * k;
        const px = c.x + Math.cos(th) * size * 0.85;
        const py = c.y + Math.sin(th) * size * 0.85;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 윤곽 미감지 상태 — 중앙 배치 가이드(코너 브라켓) + 위아래로 훑는 스윕 라인 */
function drawSearchGuide(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bw = w * 0.74;
  const bh = h * 0.6;
  const x0 = (w - bw) / 2;
  const y0 = (h - bh) / 2;
  const arm = Math.min(bw, bh) * 0.14;
  const stroke = Math.max(2, Math.min(w, h) * 0.006);

  ctx.save();
  ctx.strokeStyle = "rgba(186, 230, 253, 0.5)";
  ctx.lineWidth = stroke;
  ctx.shadowColor = "rgba(125, 211, 252, 0.7)";
  ctx.shadowBlur = Math.max(6, stroke * 3);
  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * arm);
    ctx.stroke();
  };
  corner(x0, y0, 1, 1);
  corner(x0 + bw, y0, -1, 1);
  corner(x0, y0 + bh, 1, -1);
  corner(x0 + bw, y0 + bh, -1, -1);
  ctx.restore();

  // 스윕 라인 (가이드 박스 안에서 위 → 아래 반복)
  const u = (t % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS;
  const sy = y0 + bh * u;
  const grad = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
  grad.addColorStop(0, "rgba(125,211,252,0)");
  grad.addColorStop(0.5, "rgba(224,242,255,0.9)");
  grad.addColorStop(1, "rgba(125,211,252,0)");
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.PI * u) * 0.9 + 0.1;
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2, stroke * 1.2);
  ctx.shadowColor = "rgba(255,255,255,0.8)";
  ctx.shadowBlur = Math.max(8, stroke * 4);
  ctx.beginPath();
  ctx.moveTo(x0, sy);
  ctx.lineTo(x0 + bw, sy);
  ctx.stroke();
  ctx.restore();
}

export default FishScanGlow;
