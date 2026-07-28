"use client";
/**
 * 스캔 중 물고기 윤곽선 반짝임 오버레이
 * - 물고기 외곽선을 따라 흰색/하늘색 글로우 선이 천천히 달리는 효과
 * - 윤곽선 위 여러 지점에서 별/다이아몬드 파티클이 랜덤하게 반짝임 (opacity 0→1→0 루프)
 * - 윤곽선 자체는 점선 dash offset 애니메이션으로 흐름
 * - requestAnimationFrame 기반 (Three.js 불필요), active=false 면 즉시 정지·정리
 *
 * 스캔 중에는 물고기의 실제 위치를 아직 모르므로, 컨테이너 중앙에 물고기 형태의
 * 스캔 윤곽을 그려 "이 안에 물고기를 맞춰주세요 / 인식 중"을 시각적으로 전달한다.
 */
import { useEffect, useRef } from "react";
import { ScanLine } from "lucide-react";

type Props = {
  active: boolean;
  /** 하단 안내 문구 (기본: "스캔 중...") */
  label?: string | null;
  /** 윤곽 가로 길이 (컨테이너 너비 대비 비율) */
  spanRatio?: number;
  className?: string;
};

const SPARKLE_COUNT = 14; // 윤곽 위에서 반짝이는 파티클 개수
const RUN_PERIOD_MS = 2600;   // 글로우 선이 윤곽 한 바퀴 도는 시간
const RUN_SPAN = 0.13;        // 달리는 글로우 구간 길이 (경로 비율)
const DASH_PERIOD_MS = 1800;  // 점선 흐름 주기

/** 물고기 로컬 윤곽 (x: 0=머리끝 ~ 1=꼬리끝, y: 0=중심축) */
function buildFishOutline(): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const BODY_END = 0.78;

  // 몸통 반높이 — 머리에서 0.03, 앞쪽 1/3 지점에서 최대, 미병부에서 다시 0.035
  const half = (x: number) => 0.035 + 0.175 * Math.sin(Math.PI * Math.pow(x / BODY_END, 0.8));
  // 등지느러미 / 뒷지느러미 융기
  const bump = (x: number, from: number, to: number, h: number) => {
    if (x < from || x > to) return 0;
    return h * Math.sin(Math.PI * ((x - from) / (to - from)));
  };
  const dorsal = (x: number) => bump(x, 0.34, 0.64, 0.075);
  const anal = (x: number) => bump(x, 0.56, 0.74, 0.045);

  const STEP = 0.02;
  // 등 라인 (머리 → 미병부)
  for (let x = 0; x <= BODY_END + 1e-6; x += STEP) {
    pts.push({ x, y: -(half(x) + dorsal(x)) });
  }
  // 꼬리지느러미 (위 → 갈라진 안쪽 → 아래)
  pts.push({ x: 1.0, y: -0.2 });
  pts.push({ x: 0.9, y: 0 });
  pts.push({ x: 1.0, y: 0.2 });
  // 배 라인 (미병부 → 머리)
  for (let x = BODY_END; x >= 0 - 1e-6; x -= STEP) {
    pts.push({ x, y: half(x) + anal(x) });
  }
  return pts;
}

const OUTLINE = buildFishOutline();

/** 경로 누적 길이 (0~1 위치 → 좌표 샘플링용) */
function cumulativeLengths(pts: Array<{ x: number; y: number }>) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const closing = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  acc.push(acc[acc.length - 1] + closing);
  return acc;
}

const OUTLINE_ACC = cumulativeLengths(OUTLINE);
const OUTLINE_TOTAL = OUTLINE_ACC[OUTLINE_ACC.length - 1];

/** 경로 비율 t(0~1) 위치의 로컬 좌표 */
function pointAt(t: number) {
  const target = ((t % 1) + 1) % 1 * OUTLINE_TOTAL;
  let i = 1;
  while (i < OUTLINE_ACC.length - 1 && OUTLINE_ACC[i] < target) i++;
  const segStart = OUTLINE_ACC[i - 1];
  const segLen = OUTLINE_ACC[i] - segStart || 1;
  const r = (target - segStart) / segLen;
  const a = OUTLINE[(i - 1) % OUTLINE.length];
  const b = OUTLINE[i % OUTLINE.length];
  return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
}

/** 시드 기반 의사난수 — 파티클 위치·주기를 매 렌더마다 흔들지 않기 위해 사용 */
function seeded(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function FishScanGlow({ active, label = "스캔 중...", spanRatio = 0.62, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // 최신 spanRatio 를 rAF 루프에서 참조 (루프 재시작 없이 반영)
  const spanRef = useRef(spanRatio);
  spanRef.current = spanRatio;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const start = performance.now();
    let stopped = false;

    const frame = (now: number) => {
      if (stopped) return;
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

      // ── 윤곽 배치: 컨테이너 중앙, 가로 방향 ──
      const axisLen = Math.max(1, Math.min(w * spanRef.current, h * 1.6));
      const hx = w / 2 - axisLen / 2;
      const hy = h / 2;
      const toCanvas = (p: { x: number; y: number }) => ({
        x: hx + p.x * axisLen,
        y: hy + p.y * axisLen,
      });

      const stroke = Math.max(1.5, axisLen * 0.008);

      const tracePath = () => {
        ctx.beginPath();
        OUTLINE.forEach((p, i) => {
          const c = toCanvas(p);
          if (i === 0) ctx.moveTo(c.x, c.y);
          else ctx.lineTo(c.x, c.y);
        });
        ctx.closePath();
      };

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // ① 베이스 글로우 (은은한 하늘색 외곽)
      ctx.save();
      ctx.shadowColor = "rgba(125, 211, 252, 0.9)";
      ctx.shadowBlur = Math.max(8, axisLen * 0.05);
      ctx.strokeStyle = "rgba(186, 230, 253, 0.35)";
      ctx.lineWidth = stroke * 1.4;
      tracePath();
      ctx.stroke();
      ctx.restore();

      // ② 점선 흐름 (dash offset 애니메이션)
      ctx.save();
      const dash = Math.max(6, axisLen * 0.035);
      ctx.setLineDash([dash, dash * 0.85]);
      ctx.lineDashOffset = -((t % DASH_PERIOD_MS) / DASH_PERIOD_MS) * (dash * 1.85) * 4;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = stroke;
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = Math.max(4, axisLen * 0.02);
      tracePath();
      ctx.stroke();
      ctx.restore();

      // ③ 윤곽을 따라 달리는 글로우 선
      const runT = (t % RUN_PERIOD_MS) / RUN_PERIOD_MS;
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.95)";
      ctx.shadowBlur = Math.max(14, axisLen * 0.09);
      ctx.lineWidth = stroke * 1.9;
      const SEGMENTS = 22;
      for (let i = 0; i < SEGMENTS; i++) {
        const f0 = i / SEGMENTS;
        const f1 = (i + 1) / SEGMENTS;
        const p0 = toCanvas(pointAt(runT + f0 * RUN_SPAN));
        const p1 = toCanvas(pointAt(runT + f1 * RUN_SPAN));
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
        const pos = seeded(i);
        const period = 900 + seeded(i + 51) * 1400;
        const phase = seeded(i + 97);
        const cycle = ((t / period + phase) % 1 + 1) % 1;
        const opacity = Math.pow(Math.sin(Math.PI * cycle), 2); // 0 → 1 → 0
        if (opacity < 0.03) continue;
        const c = toCanvas(pointAt(pos));
        const size = (axisLen * 0.016) * (0.6 + seeded(i + 13) * 0.9) * (0.5 + opacity * 0.7);
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

      rafRef.current = requestAnimationFrame(frame);
    };

    frame(start); // 첫 프레임은 즉시 렌더 (rAF 대기 없이 윤곽 표시) — 이후 자체적으로 루프
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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

export default FishScanGlow;
