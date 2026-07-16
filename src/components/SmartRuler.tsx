"use client";
import { memo, useRef, useState } from "react";
import {
  Ruler, RotateCcw, Check, Crosshair, Fish,
  ZoomIn, ZoomOut, Maximize, Download,
  CreditCard, Coins, FileText, PenLine,
  Scale, TrendingUp, TrendingDown, Minus, Hand,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  REFERENCE_OBJECTS, referenceByKey,
  estimateWeightKg, formatWeight, vsAveragePct, speciesAvgCm, SPECIES_AVG_CM,
} from "@/lib/fishData";

export type RulerResult = {
  calibrationStart: { x: number; y: number };
  calibrationEnd: { x: number; y: number };
  calibrationLengthCm: number;
  fishHeadPoint: { x: number; y: number };
  fishTailPoint: { x: number; y: number };
  measuredLengthCm: number;
  confidence: number;
  measuredImageDataUrl?: string;
  /** 보정에 사용한 기준물체 (신용카드/500원 동전/A4/계측자/직접입력) */
  referenceType?: string;
  referenceLabel?: string;
};

// 기준물체별 라인 아이콘 (라인형 심플 아이콘)
const REF_ICONS: Record<string, React.ReactNode> = {
  CREDIT_CARD: <CreditCard size={14} />,
  COIN_500: <Coins size={14} />,
  A4_PAPER: <FileText size={14} />,
  RULER_30: <Ruler size={14} />,
  CUSTOM: <PenLine size={14} />,
};

type Pt = { x: number; y: number };
type Mode = "calStart" | "calEnd" | "fishHead" | "fishTail" | "done";
type PointKey = "calStart" | "calEnd" | "fishHead" | "fishTail";

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CAL_COLOR = "#2dd4bf"; // aqua / cyan
const FISH_COLOR = "#f59e0b"; // amber

// 어종 목록 (fishData 에서)
const ALL_SPECIES_NAMES = Object.keys(SPECIES_AVG_CM);

// 사진 기반 물고기 길이 측정 (참고 앱: 하라스/HARAS 류 스마트 자)
// 1) 기준 길이 보정(자/계측판) → percentPerCm  2) 물고기 입~꼬리 측정 → cm 환산
// + 2-터치 자동 측정 모드: 터치포인트 2개 동시에 올리면 fishHead/fishTail 자동 배치
function SmartRulerImpl({
  imageUrl, onComplete, species: speciesProp,
}: {
  imageUrl: string;
  onComplete: (r: RulerResult) => void;
  /** 외부에서 어종 전달 시 내부 선택기 숨김 */
  species?: string;
}) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("calStart");
  const [calStart, setCalStart] = useState<Pt | null>(null);
  const [calEnd, setCalEnd] = useState<Pt | null>(null);
  const [fishHead, setFishHead] = useState<Pt | null>(null);
  const [fishTail, setFishTail] = useState<Pt | null>(null);
  const [calCm, setCalCm] = useState<number>(30);
  const [refKey, setRefKey] = useState<string>("RULER_30"); // 선택된 기준물체
  // 어종 선택 (외부 prop 없을 때 내부 선택기 사용)
  const [speciesInternal, setSpeciesInternal] = useState<string>("");
  const species = speciesProp ?? speciesInternal;

  function pickReference(key: string) {
    setRefKey(key);
    const ref = referenceByKey(key);
    if (ref && ref.lengthCm > 0) setCalCm(ref.lengthCm);
  }

  // --- view transform (zoom & pan) ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 }); // px offset (transform-origin 0 0)

  // --- 멀티터치(2-finger) 자동 측정 상태 ---
  const activePointers = useRef<Map<number, Pt>>(new Map()); // pointerId → 좌표
  const twoTouchActive = useRef(false); // 현재 2-finger 모드 진행 중

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
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
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
    else if (mode === "fishTail") { setFishTail(p); setMode("done"); }
  }

  // ---- 캔버스 포인터 핸들러 ----
  function onCanvasPointerDown(e: React.PointerEvent) {
    const p = ptFromEvent(e);
    activePointers.current.set(e.pointerId, p);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    // 2-터치 자동 측정 모드 진입
    if (activePointers.current.size === 2) {
      twoTouchActive.current = true;
      const pts = Array.from(activePointers.current.values());
      setFishHead(pts[0]);
      setFishTail(pts[1]);
      setMode("done");
      // 패닝/드래그 취소
      panning.current = null;
      draggingPoint.current = null;
      return;
    }

    // 1-터치: 기존 동작
    movedRef.current = false;
    panning.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const p = ptFromEvent(e);

    // 2-finger 모드: 두 포인터 위치로 fishHead/fishTail 실시간 갱신
    if (twoTouchActive.current) {
      activePointers.current.set(e.pointerId, p);
      const pts = Array.from(activePointers.current.values());
      if (pts.length >= 2) {
        setFishHead(pts[0]);
        setFishTail(pts[1]);
      }
      return;
    }

    if (draggingPoint.current) {
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
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) {
      twoTouchActive.current = false;
    }

    if (draggingPoint.current) {
      draggingPoint.current = null;
      return;
    }
    if (panning.current && !movedRef.current) {
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

  // 측정 신뢰도
  const confidence = (() => {
    if (!calStart || !calEnd || !fishHead || !fishTail) return 0;
    const calLen = dist(calStart, calEnd);
    const fishLen = dist(fishHead, fishTail);
    const lenScore = Math.min(1, fishLen / 25) * Math.min(1, calLen / 15);
    const tilt = Math.abs(Math.atan2(fishTail.y - fishHead.y, fishTail.x - fishHead.x));
    const tiltScore = 1 - Math.min(1, Math.abs(Math.sin(tilt)) * 0.6);
    return Math.round((70 + lenScore * 20 + tiltScore * 8) * 10) / 10;
  })();

  // 어종 비교 파생값
  const estWeightKg = estimateWeightKg(species || null, measuredCm);
  const avgCm = speciesAvgCm(species || null);
  const vsPct = vsAveragePct(species || null, measuredCm);

  function reset() {
    setCalStart(null); setCalEnd(null); setFishHead(null); setFishTail(null);
    setMode("calStart");
    activePointers.current.clear();
    twoTouchActive.current = false;
    resetView();
  }

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
          const side = Math.max(img.naturalWidth, img.naturalHeight) || 1000;
          canvas.width = side;
          canvas.height = side;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.fillStyle = "#0b1830";
          ctx.fillRect(0, 0, side, side);
          const scale = Math.min(side / img.naturalWidth, side / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const dx = (side - dw) / 2;
          const dy = (side - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);

          const P = (p: Pt) => ({ x: (p.x / 100) * side, y: (p.y / 100) * side });
          const cs = P(calStart), ce = P(calEnd), fh = P(fishHead), ft = P(fishTail);
          const lw = Math.max(2, side / 300);

          ctx.save();
          ctx.setLineDash([lw * 3, lw * 2]);
          ctx.strokeStyle = CAL_COLOR; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(cs.x, cs.y); ctx.lineTo(ce.x, ce.y); ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = FISH_COLOR; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(fh.x, fh.y); ctx.lineTo(ft.x, ft.y); ctx.stroke();
          const dot = (p: { x: number; y: number }, c: string) => {
            ctx.beginPath(); ctx.arc(p.x, p.y, lw * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = c; ctx.fill();
            ctx.lineWidth = lw * 0.8; ctx.strokeStyle = "#fff"; ctx.stroke();
          };
          dot(cs, CAL_COLOR); dot(ce, CAL_COLOR); dot(fh, FISH_COLOR); dot(ft, FISH_COLOR);

          const speciesLabel = species ? ` · ${species}` : "";
          const label = `${measuredCm.toFixed(1)}cm${speciesLabel}  ·  ${confidence}%  ·  기준: ${refLabel} ${calCm}cm`;
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
          resolve(null);
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
      referenceType: refKey, referenceLabel: refLabel,
      ...(measuredImageDataUrl ? { measuredImageDataUrl } : {}),
    });
  }

  const refLabel = referenceByKey(refKey)?.label ?? "기준물체";

  const STEP_GUIDE: Record<Mode, string> = {
    calStart: `1) 기준물체(${refLabel})의 시작점을 탭하세요`,
    calEnd: `2) 기준물체(${refLabel})의 끝점을 탭하세요`,
    fishHead: "3) 물고기 입 끝을 탭하세요",
    fishTail: "4) 물고기 꼬리 끝을 탭하세요",
    done: "측정 완료! 점을 드래그해 미세조정 가능",
  };

  // SVG draggable point
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
      {/* 2-터치 모드 안내 */}
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-aqua-50 px-3 py-2 text-sm font-medium text-aqua-700">
        <Crosshair size={16} /> {STEP_GUIDE[mode]}
      </div>
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-navy-50/60 px-3 py-1.5 text-[11px] text-navy-400">
        <Hand size={13} />
        <span>손가락 2개를 동시에 올리면 두 점 사이 거리 자동 측정 (2-터치 모드)</span>
      </div>

      {/* 툴바 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ToolBtn onClick={() => zoomBy(1.25)} label="확대"><ZoomIn size={16} /></ToolBtn>
        <ToolBtn onClick={() => zoomBy(1 / 1.25)} label="축소"><ZoomOut size={16} /></ToolBtn>
        <ToolBtn onClick={resetView} label="화면 맞춤"><Maximize size={16} /></ToolBtn>
        <ToolBtn onClick={resetBaseline} label="기준선 재설정"><RotateCcw size={16} /></ToolBtn>
        <ToolBtn onClick={saveImage} label="결과 이미지 저장" disabled={measuredCm == null}><Download size={16} /></ToolBtn>
      </div>

      {/* 측정 캔버스 */}
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
            {calStart && calEnd && (
              <LineLabel a={calStart} b={calEnd} text={`${refLabel} ${calCm}cm`} color={CAL_COLOR} zoom={zoom} />
            )}
            {fishHead && fishTail && measuredCm != null && (
              <LineLabel a={fishHead} b={fishTail} text={`${measuredCm.toFixed(1)}cm (${(measuredCm * 10).toFixed(0)}mm)`} color={FISH_COLOR} zoom={zoom} big />
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
        탭: 점 찍기 · 드래그: 미세조정 · 휠/버튼: 확대 후 이동 · 두 손가락: 자동 측정
      </p>

      {/* 기준물체 선택 */}
      <div className="mt-3">
        <p className="mb-1.5 text-sm font-semibold text-navy-700">기준물체 선택</p>
        <div className="flex flex-wrap gap-1.5">
          {REFERENCE_OBJECTS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => pickReference(r.key)}
              title={r.hint}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                refKey === r.key ? "bg-orange-500 text-white" : "bg-navy-50 text-navy-600"
              }`}
            >
              {REF_ICONS[r.key]}
              {r.label}{r.lengthCm > 0 ? ` ${r.lengthCm}cm` : ""}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs font-medium text-navy-400">기준 길이</label>
          <input
            type="number"
            step="0.01"
            value={calCm}
            onChange={(e) => { setCalCm(Number(e.target.value) || 0); setRefKey("CUSTOM"); }}
            className="w-24 rounded-lg border border-navy-100 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-navy-400">cm</span>
          <span className="text-[11px] text-navy-300">{referenceByKey(refKey)?.hint}</span>
        </div>
      </div>

      {/* 어종 선택 (외부에서 prop으로 전달되지 않은 경우에만 표시) */}
      {!speciesProp && (
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-semibold text-navy-700">어종 선택 (선택사항 — 평균 대비 비교)</p>
          <select
            value={speciesInternal}
            onChange={(e) => setSpeciesInternal(e.target.value)}
            className="w-full rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700"
          >
            <option value="">어종 선택 안함</option>
            {ALL_SPECIES_NAMES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* 측정 결과 */}
      <div className="mt-3 rounded-2xl bg-navy-50/70 p-4 text-center">
        {measuredCm != null ? (
          <>
            <p className="flex items-center justify-center gap-1 text-xs text-navy-400"><Ruler size={13} /> 측정 길이</p>
            <p className="text-4xl font-extrabold text-navy-800">
              {measuredCm.toFixed(1)}<span className="text-xl">cm</span>
              <span className="ml-2 text-2xl text-navy-400">({(measuredCm * 10).toFixed(0)}mm)</span>
            </p>
            <p className="mt-1 text-xs text-navy-400">측정 신뢰도 {confidence}%</p>

            {/* 어종 비교 정보 */}
            {species && (
              <div className="mt-3 space-y-2 rounded-xl bg-white/70 p-3 text-left">
                {/* 추정 무게 */}
                {estWeightKg != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Scale size={14} className="shrink-0 text-navy-400" />
                    <span className="text-navy-500">추정 무게:</span>
                    <span className="font-bold text-navy-800">{formatWeight(estWeightKg)}</span>
                  </div>
                )}
                {/* 어종 평균 대비 */}
                {avgCm != null && vsPct != null && (
                  <div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-navy-400">{species} 평균 {avgCm}cm 대비</span>
                      <span className={`flex items-center gap-0.5 font-bold ${vsPct > 100 ? "text-emerald-500" : vsPct < 100 ? "text-navy-400" : "text-navy-400"}`}>
                        {vsPct > 100 ? <TrendingUp size={13} /> : vsPct < 100 ? <TrendingDown size={13} /> : <Minus size={13} />}
                        {vsPct > 100 ? `+${vsPct - 100}%` : vsPct < 100 ? `-${100 - vsPct}%` : "평균"}
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                      <div
                        className={`h-full rounded-full ${vsPct >= 100 ? "bg-emerald-400" : "bg-aqua-500/70"}`}
                        style={{ width: `${Math.min(100, (vsPct / 150) * 100)}%` }}
                      />
                      {/* 평균선 마커 (150% 스케일에서 100% = 66.7%) */}
                      <div className="absolute top-0 h-full w-px bg-navy-300/70" style={{ left: "66.7%" }} />
                    </div>
                    {vsPct >= 120 && (
                      <p className="mt-1.5 text-center text-[11px] font-bold text-emerald-500">
                        평균 대비 {vsPct - 100}% 초과 — 훌륭한 기록입니다!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="flex items-center justify-center gap-1 py-3 text-sm text-navy-300">
            <Fish size={16} /> 4개 점을 모두 탭하면 길이가 계산됩니다
          </p>
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

// 선분 중앙에 붙는 실시간 측정값 라벨 (SVG)
function LineLabel({ a, b, text, color, zoom, big }: { a: Pt; b: Pt; text: string; color: string; zoom: number; big?: boolean }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const fs = (big ? 13 : 10) / zoom;
  return (
    <text
      x={`${mx}%`}
      y={`${my}%`}
      dy={-8 / zoom}
      textAnchor="middle"
      fill={color}
      stroke="rgba(11,24,48,0.85)"
      strokeWidth={3.5 / zoom}
      style={{ paintOrder: "stroke", fontWeight: 800, fontSize: fs, pointerEvents: "none", userSelect: "none" }}
    >
      {text}
    </text>
  );
}

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
