"use client";
import { memo, useRef, useState } from "react";
import {
  Ruler, RotateCcw, Check, Crosshair, Fish,
  ZoomIn, ZoomOut, Maximize, Download,
} from "lucide-react";
import { useToast } from "@/components/Toast";

export type RulerResult = {
  calibrationStart: { x: number; y: number };
  calibrationEnd: { x: number; y: number };
  calibrationLengthCm: number;
  fishHeadPoint: { x: number; y: number };
  fishTailPoint: { x: number; y: number };
  measuredLengthCm: number;
  confidence: number;
  measuredImageDataUrl?: string;
};

type Pt = { x: number; y: number };
type Mode = "calStart" | "calEnd" | "fishHead" | "fishTail";
type PointKey = "calStart" | "calEnd" | "fishHead" | "fishTail";

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CAL_COLOR = "#2dd4bf"; // aqua / cyan
const FISH_COLOR = "#f59e0b"; // amber

// 사진 기반 물고기 길이 측정 (참고 앱: 하라스/HARAS 류 스마트 자)
// 1) 기준 길이 보정(자/계측판) → percentPerCm 2) 물고기 입~꼬리 측정 → cm 환산
function SmartRulerImpl({ imageUrl, onComplete }: { imageUrl: string; onComplete: (r: RulerResult) => void }) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("calStart");
  const [calStart, setCalStart] = useState<Pt | null>(null);
  const [calEnd, setCalEnd] = useState<Pt | null>(null);
  const [fishHead, setFishHead] = useState<Pt | null>(null);
  const [fishTail, setFishTail] = useState<Pt | null>(null);
  const [calCm, setCalCm] = useState<number>(30);

  // --- view transform (zoom & pan) ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 }); // px offset (transform-origin 0 0)

  // gesture state held in refs so handlers stay stable
  const draggingPoint = useRef<PointKey | null>(null);
  const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const movedRef = useRef(false); // distinguish drag from tap

  const setters: Record<PointKey, (p: Pt) => void> = {
    calStart: setCalStart, calEnd: setCalEnd, fishHead: setFishHead, fishTail: setFishTail,
  };
  const points: Record<PointKey, Pt | null> = { calStart, calEnd, fishHead, fishTail };

  // screen client coords -> image-normalized percent (invert the CSS transform)
  function screenToPct(clientX: number, clientY: number): Pt {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    // position inside (untransformed) wrapper box
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    // invert transform: translate(pan) then scale(zoom), origin top-left
    const localX = (sx - pan.x) / zoom;
    const localY = (sy - pan.y) / zoom;
    return {
      x: clamp((localX / rect.width) * 100, 0, 100),
      y: clamp((localY / rect.height) * 100, 0, 100),
    };
  }

  function ptFromEvent(e: { clientX: number; clientY: number }): Pt {
    return screenToPct(e.clientX, e.clientY);
  }

  function placeNext(p: Pt) {
    if (mode === "calStart") { setCalStart(p); setMode("calEnd"); }
    else if (mode === "calEnd") { setCalEnd(p); setMode("fishHead"); }
    else if (mode === "fishHead") { setFishHead(p); setMode("fishTail"); }
    else { setFishTail(p); }
  }

  // ---- pointer handlers on the canvas wrapper ----
  function onCanvasPointerDown(e: React.PointerEvent) {
    // dragging a point is handled by point-specific handlers (they stopPropagation)
    movedRef.current = false;
    panning.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (draggingPoint.current) {
      const p = ptFromEvent(e);
      setters[draggingPoint.current](p);
      return;
    }
    if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
      if (zoom > 1) {
        setPan({ x: panning.current.panX + dx, y: panning.current.panY + dy });
      }
    }
  }

  function onCanvasPointerUp(e: React.PointerEvent) {
    if (draggingPoint.current) {
      draggingPoint.current = null;
      return;
    }
    if (panning.current && !movedRef.current) {
      // treat as a tap -> place point
      placeNext(ptFromEvent(e));
    }
    panning.current = null;
  }

  function onPointPointerDown(key: PointKey, e: React.PointerEvent) {
    e.stopPropagation();
    draggingPoint.current = key;
    panning.current = null;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomBy(factor, e.clientX, e.clientY);
  }

  // zoom keeping the given screen anchor stable; default anchor = center
  function zoomBy(factor: number, anchorClientX?: number, anchorClientY?: number) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ax = (anchorClientX ?? rect.left + rect.width / 2) - rect.left;
    const ay = (anchorClientY ?? rect.top + rect.height / 2) - rect.top;
    setZoom((z) => {
      const nz = clamp(z * factor, 1, 8);
      const realFactor = nz / z;
      setPan((p) => ({
        x: ax - (ax - p.x) * realFactor,
        y: ay - (ay - p.y) * realFactor,
      }));
      return nz;
    });
  }

  function resetView() {
    setZoom(1); setPan({ x: 0, y: 0 });
  }

  const pctPerCm = (() => (calStart && calEnd ? dist(calStart, calEnd) / calCm : 0))();
  const measuredCm = (() => {
    if (!fishHead || !fishTail || pctPerCm <= 0) return null;
    return Math.round((dist(fishHead, fishTail) / pctPerCm) * 10) / 10;
  })();

  // 측정 신뢰도: 기준선·측정선이 충분히 길고 수평에 가까울수록 높음
  const confidence = (() => {
    if (!calStart || !calEnd || !fishHead || !fishTail) return 0;
    const calLen = dist(calStart, calEnd);
    const fishLen = dist(fishHead, fishTail);
    const lenScore = Math.min(1, fishLen / 25) * Math.min(1, calLen / 15);
    const tilt = Math.abs(Math.atan2(fishTail.y - fishHead.y, fishTail.x - fishHead.x));
    const tiltScore = 1 - Math.min(1, Math.abs(Math.sin(tilt)) * 0.6);
    return Math.round((70 + lenScore * 20 + tiltScore * 8) * 10) / 10;
  })();

  function reset() {
    setCalStart(null); setCalEnd(null); setFishHead(null); setFishTail(null); setMode("calStart");
    resetView();
  }

  // 기준선만 재설정 (물고기 점 유지)
  function resetBaseline() {
    setCalStart(null); setCalEnd(null); setMode("calStart");
  }

  // 측정 결과 이미지를 원본 해상도 캔버스에 그려서 PNG 생성
  async function renderResultDataUrl(): Promise<string | null> {
    if (!calStart || !calEnd || !fishHead || !fishTail || measuredCm == null) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          // object-contain in a square box: draw on a square canvas matching the box,
          // letterboxing the image. Points are normalized to this square box (0..100).
          const side = Math.max(img.naturalWidth, img.naturalHeight) || 1000;
          canvas.width = side;
          canvas.height = side;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.fillStyle = "#0b1830"; // navy-900-ish backdrop (matches box bg)
          ctx.fillRect(0, 0, side, side);
          // object-contain placement inside square
          const scale = Math.min(side / img.naturalWidth, side / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const dx = (side - dw) / 2;
          const dy = (side - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);

          const P = (p: Pt) => ({ x: (p.x / 100) * side, y: (p.y / 100) * side });
          const cs = P(calStart), ce = P(calEnd), fh = P(fishHead), ft = P(fishTail);
          const lw = Math.max(2, side / 300);

          // calibration line (dashed cyan)
          ctx.save();
          ctx.setLineDash([lw * 3, lw * 2]);
          ctx.strokeStyle = CAL_COLOR; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(cs.x, cs.y); ctx.lineTo(ce.x, ce.y); ctx.stroke();
          ctx.restore();
          // fish line (amber)
          ctx.strokeStyle = FISH_COLOR; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(fh.x, fh.y); ctx.lineTo(ft.x, ft.y); ctx.stroke();
          // markers
          const dot = (p: { x: number; y: number }, c: string) => {
            ctx.beginPath(); ctx.arc(p.x, p.y, lw * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = c; ctx.fill();
            ctx.lineWidth = lw * 0.8; ctx.strokeStyle = "#fff"; ctx.stroke();
          };
          dot(cs, CAL_COLOR); dot(ce, CAL_COLOR); dot(fh, FISH_COLOR); dot(ft, FISH_COLOR);

          // label
          const label = `${measuredCm.toFixed(1)}cm  ·  ${confidence}%`;
          const fs = Math.max(18, side / 22);
          ctx.font = `bold ${fs}px sans-serif`;
          const tw = ctx.measureText(label).width;
          const pad = fs * 0.5;
          ctx.fillStyle = "rgba(11,24,48,0.82)";
          ctx.fillRect(pad, pad, tw + pad * 2, fs + pad * 1.2);
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "top";
          ctx.fillText(label, pad * 2, pad * 1.1);

          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null); // tainted canvas / cross-origin
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  async function saveImage() {
    if (measuredCm == null) { toast("측정을 먼저 완료해주세요", "error"); return; }
    const url = await renderResultDataUrl();
    if (!url) {
      toast("이미지 저장은 직접 촬영/업로드한 사진에서 가능합니다", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = url; a.download = "ipnak-measure.png";
    document.body.appendChild(a); a.click(); a.remove();
    toast("측정 결과 이미지를 저장했어요", "success");
  }

  async function complete() {
    if (!calStart || !calEnd || !fishHead || !fishTail || measuredCm == null) {
      toast("보정과 측정을 모두 완료해주세요", "error"); return;
    }
    const measuredImageDataUrl = (await renderResultDataUrl()) ?? undefined;
    onComplete({
      calibrationStart: calStart, calibrationEnd: calEnd, calibrationLengthCm: calCm,
      fishHeadPoint: fishHead, fishTailPoint: fishTail, measuredLengthCm: measuredCm, confidence,
      ...(measuredImageDataUrl ? { measuredImageDataUrl } : {}),
    });
  }

  const STEP_GUIDE: Record<Mode, string> = {
    calStart: "1) 기준 자(계측판)의 시작점을 탭하세요",
    calEnd: "2) 기준 자의 끝점을 탭하세요",
    fishHead: "3) 물고기 입 끝을 탭하세요",
    fishTail: "4) 물고기 꼬리 끝을 탭하세요",
  };

  // SVG draggable point (visible dot + larger invisible hit target)
  function PointHandle({ k, p, color }: { k: PointKey; p: Pt; color: string }) {
    return (
      <g style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => onPointPointerDown(k, e)}>
        <circle cx={`${p.x}%`} cy={`${p.y}%`} r={16} fill="transparent" />
        <circle cx={`${p.x}%`} cy={`${p.y}%`} r={6} fill={color} stroke="#fff" strokeWidth={2} />
      </g>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-aqua-50 px-3 py-2 text-sm font-medium text-aqua-700">
        <Crosshair size={16} /> {STEP_GUIDE[mode]}
      </div>

      {/* 툴바: 확대/축소/뷰 초기화/기준선/저장 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ToolBtn onClick={() => zoomBy(1.25)} label="확대"><ZoomIn size={16} /></ToolBtn>
        <ToolBtn onClick={() => zoomBy(1 / 1.25)} label="축소"><ZoomOut size={16} /></ToolBtn>
        <ToolBtn onClick={resetView} label="화면 맞춤"><Maximize size={16} /></ToolBtn>
        <ToolBtn onClick={resetBaseline} label="기준선 재설정"><RotateCcw size={16} /></ToolBtn>
        <ToolBtn onClick={saveImage} label="결과 이미지 저장" disabled={measuredCm == null}><Download size={16} /></ToolBtn>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={onWheel}
        className="relative w-full select-none overflow-hidden rounded-xl bg-[#1a1a1a]"
        style={{ aspectRatio: "1 / 1", cursor: zoom > 1 ? "grab" : "crosshair", touchAction: "none" }}
      >
        {/* inner container holds BOTH img + svg, transformed together */}
        <div
          className="absolute inset-0 h-full w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <img src={imageUrl} alt="측정 대상 사진" className="pointer-events-none h-full w-full object-contain" />
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
            {calStart && calEnd && (
              <line x1={`${calStart.x}%`} y1={`${calStart.y}%`} x2={`${calEnd.x}%`} y2={`${calEnd.y}%`} stroke={CAL_COLOR} strokeWidth={3 / zoom} strokeDasharray="6 4" />
            )}
            {fishHead && fishTail && (
              <line x1={`${fishHead.x}%`} y1={`${fishHead.y}%`} x2={`${fishTail.x}%`} y2={`${fishTail.y}%`} stroke={FISH_COLOR} strokeWidth={3 / zoom} />
            )}
            <g style={{ pointerEvents: "auto" }}>
              {calStart && <PointHandle k="calStart" p={calStart} color={CAL_COLOR} />}
              {calEnd && <PointHandle k="calEnd" p={calEnd} color={CAL_COLOR} />}
              {fishHead && <PointHandle k="fishHead" p={fishHead} color={FISH_COLOR} />}
              {fishTail && <PointHandle k="fishTail" p={fishTail} color={FISH_COLOR} />}
            </g>
          </svg>
        </div>
      </div>

      <p className="mt-1 text-center text-[11px] text-navy-300">
        탭하여 점 찍기 · 점을 드래그해 미세조정 · 휠/버튼으로 확대 후 드래그하면 이동
      </p>

      {/* 기준 길이 입력 */}
      <div className="mt-3 flex items-center gap-2">
        <label className="text-sm font-semibold text-navy-700">기준 길이</label>
        <div className="flex gap-1">
          {[10, 30, 50].map((v) => (
            <button key={v} onClick={() => setCalCm(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${calCm === v ? "bg-orange-500 text-white" : "bg-navy-50 text-navy-600"}`}>{v}cm</button>
          ))}
        </div>
        <input type="number" value={calCm} onChange={(e) => setCalCm(Number(e.target.value) || 0)}
          className="w-20 rounded-lg border border-navy-100 px-2 py-1.5 text-sm" /> <span className="text-sm text-navy-400">cm</span>
      </div>

      {/* 결과 */}
      <div className="mt-3 rounded-2xl bg-navy-50/70 p-4 text-center">
        {measuredCm != null ? (
          <>
            <p className="flex items-center justify-center gap-1 text-xs text-navy-400"><Ruler size={13} /> 측정 길이</p>
            <p className="text-4xl font-extrabold text-navy-800">{measuredCm.toFixed(1)}<span className="text-xl">cm</span></p>
            <p className="mt-1 text-xs text-navy-400">측정 신뢰도 {confidence}%</p>
          </>
        ) : (
          <p className="flex items-center justify-center gap-1 py-3 text-sm text-navy-300"><Fish size={16} /> 4개 점을 모두 탭하면 길이가 계산됩니다</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={reset} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy-50 py-3 text-sm font-semibold text-navy-700">
          <RotateCcw size={16} /> 재측정
        </button>
        <button onClick={complete} disabled={measuredCm == null}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white disabled:opacity-40">
          <Check size={16} /> 측정 완료
        </button>
      </div>
    </div>
  );
}

export const SmartRuler = memo(SmartRulerImpl);

function ToolBtn({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center gap-1 rounded-lg border border-navy-100 bg-[#1e1e1e] px-2.5 py-1.5 text-xs font-medium text-navy-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}