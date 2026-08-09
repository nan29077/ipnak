"use client";
/**
 * YOLO 네이티브 라벨링 캔버스
 *
 * - 이미지 위 캔버스 오버레이에 마우스/터치 드래그로 바운딩 박스를 그린다
 * - 박스마다 클래스(fish / ipnak-ball / ipnak-keyring) 지정·변경·삭제
 * - 좌표는 항상 0~1 정규화로 보관 → 저장 시 그대로 YOLO 포맷이 된다
 *
 * 좌표계 정리
 *   box  : 0~1 정규화 (cx, cy, w, h) — 저장/전달용
 *   화면 : 캔버스 픽셀 — 렌더링·히트테스트용. 둘 사이 변환만 신경 쓰면 된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Save, Loader2, Undo2, MousePointerSquareDashed } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { YOLO_CLASSES, YOLO_CLASS_COLOR, YOLO_CLASS_LABEL, type YoloClassName } from "@/lib/yolo/types";

export type LabelBox = { classId: number; cx: number; cy: number; w: number; h: number };

type Props = {
  /** training-data/raw 안의 파일명 */
  imageName: string;
  /** 저장 완료 시 알림 (목록 갱신용) */
  onSaved?: (boxCount: number) => void;
  /** 저장 안 된 변경 여부 알림 (부모가 이미지 전환 시 유실 경고에 사용) */
  onDirtyChange?: (dirty: boolean) => void;
};

/** 드래그 최소 크기(px) — 이보다 작으면 클릭으로 간주해 박스를 만들지 않는다 */
const MIN_DRAG_PX = 6;

export function YoloLabeler({ imageName, onSaved, onDirtyChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [boxes, setBoxes] = useState<LabelBox[]>([]);
  const [activeClass, setActiveClass] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // 드래그 상태 (리렌더를 유발하지 않도록 ref 로 관리)
  const dragRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /* ── 이미지 + 기존 라벨 로드 ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMsg("");
    setSelected(null);
    setDirty(false);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setMsg("이미지를 불러오지 못했습니다.");
      setLoading(false);
    };
    img.src = `/api/admin/ai-training/images/${encodeURIComponent(imageName)}`;

    fetch(`/api/admin/ai-training/labels?image=${encodeURIComponent(imageName)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { boxes: [] }))
      .then((d) => { if (!cancelled) setBoxes(Array.isArray(d.boxes) ? d.boxes : []); })
      .catch(() => { if (!cancelled) setBoxes([]); });

    return () => { cancelled = true; };
  }, [imageName]);

  /* ── 캔버스 렌더 ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !img || !wrap || !imgSize.w) return;

    // 컨테이너 폭에 맞춰 캔버스 크기를 잡는다 (원본 비율 유지)
    const cssW = wrap.clientWidth;
    const cssH = Math.round((cssW * imgSize.h) / imgSize.w);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(img, 0, 0, cssW, cssH);

    // 저장된 박스
    boxes.forEach((b, i) => {
      const x = (b.cx - b.w / 2) * cssW;
      const y = (b.cy - b.h / 2) * cssH;
      const w = b.w * cssW;
      const h = b.h * cssH;
      const name = (YOLO_CLASSES[b.classId] ?? "fish") as YoloClassName;
      const color = YOLO_CLASS_COLOR[name];
      const isSel = selected === i;

      ctx.lineWidth = isSel ? 3 : 2;
      ctx.strokeStyle = color;
      ctx.setLineDash(isSel ? [6, 4] : []);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // 클래스 라벨 배지
      const label = YOLO_CLASS_LABEL[name];
      ctx.font = "600 12px system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      const by = y - 18 < 0 ? y : y - 18;
      ctx.fillStyle = color;
      ctx.fillRect(x, by, tw + 12, 18);
      ctx.fillStyle = "#111827";
      ctx.fillText(label, x + 6, by + 13);
    });

    // 드래그 중인 임시 박스
    const d = dragRef.current;
    if (d) {
      const name = (YOLO_CLASSES[activeClass] ?? "fish") as YoloClassName;
      ctx.strokeStyle = YOLO_CLASS_COLOR[name];
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.setLineDash([]);
    }
  }, [boxes, selected, imgSize, activeClass]);

  useEffect(() => { draw(); }, [draw]);

  // 저장 안 된 변경 여부를 부모에 알린다 (리마운트 시 false 로 자동 초기화)
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // 창 크기 변경 시 캔버스 재계산
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  /* ── 포인터 좌표 → 캔버스 CSS 픽셀 ── */
  function toLocal(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(rect.width, Math.max(0, e.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, e.clientY - rect.top)),
      w: rect.width,
      h: rect.height,
    };
  }

  /** 클릭 지점에 있는 박스 인덱스 (작은 박스를 우선 선택) */
  function hitTest(px: number, py: number, cssW: number, cssH: number): number | null {
    let found: number | null = null;
    let smallest = Infinity;
    boxes.forEach((b, i) => {
      const x = (b.cx - b.w / 2) * cssW;
      const y = (b.cy - b.h / 2) * cssH;
      const w = b.w * cssW;
      const h = b.h * cssH;
      if (px >= x && px <= x + w && py >= y && py <= y + h && w * h < smallest) {
        smallest = w * h;
        found = i;
      }
    });
    return found;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (loading) return;
    const { x, y } = toLocal(e);
    // 항상 드래그를 시작한다 — 기존 박스 "안"에서도 새 박스를 그릴 수 있어야 한다
    // (물고기 박스 위에 겹친 입낚볼/키링이 핵심 시나리오).
    // 실제 클릭(6px 미만 이동)이었는지는 onPointerUp 에서 판정해 선택으로 처리한다.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x0: x, y0: y, x1: x, y1: y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const { x, y } = toLocal(e);
    dragRef.current.x1 = x;
    dragRef.current.y1 = y;
    draw();
  }

  /** 드래그 취소 (터치 제스처 중단·전화 수신 등) — 박스를 만들지 않고 버린다 */
  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    draw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const { x, y, w: cssW, h: cssH } = toLocal(e);
    const bw = Math.abs(d.x1 - d.x0);
    const bh = Math.abs(d.y1 - d.y0);
    if (bw < MIN_DRAG_PX || bh < MIN_DRAG_PX) {
      // 클릭에 가까운 동작 — 박스를 만들지 않고, 그 지점의 기존 박스를 선택한다
      setSelected(hitTest(x, y, cssW, cssH));
      draw();
      return;
    }

    const cx = (Math.min(d.x0, d.x1) + bw / 2) / cssW;
    const cy = (Math.min(d.y0, d.y1) + bh / 2) / cssH;
    const next: LabelBox = { classId: activeClass, cx, cy, w: bw / cssW, h: bh / cssH };
    setBoxes((prev) => [...prev, next]);
    setSelected(boxes.length);
    setDirty(true);
  }

  function removeBox(index: number) {
    setBoxes((prev) => prev.filter((_, i) => i !== index));
    setSelected(null);
    setDirty(true);
  }

  function changeClass(index: number, classId: number) {
    setBoxes((prev) => prev.map((b, i) => (i === index ? { ...b, classId } : b)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/ai-training/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageName, boxes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "저장에 실패했습니다.");
        return;
      }
      setDirty(false);
      setMsg(boxes.length === 0 ? "물체 없음(negative)으로 저장했습니다." : `박스 ${data.saved}개를 저장했습니다.`);
      onSaved?.(data.saved ?? boxes.length);
    } catch {
      setMsg("저장 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 클래스 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-navy-400">그릴 클래스</span>
        {YOLO_CLASSES.map((name, id) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveClass(id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              activeClass === id
                ? "border-transparent text-gray-900"
                : "border-navy-100 text-navy-400 hover:bg-white/[0.04]",
            )}
            style={activeClass === id ? { backgroundColor: YOLO_CLASS_COLOR[name] } : undefined}
          >
            {YOLO_CLASS_LABEL[name]}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-navy-400">
          <MousePointerSquareDashed size={13} /> 드래그로 박스 · 클릭으로 선택
        </span>
      </div>

      {/* 캔버스 */}
      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-navy-100 bg-black/30">
        {loading ? (
          <div className="flex aspect-[4/3] items-center justify-center gap-2 text-[13px] text-navy-400">
            <Loader2 size={16} className="animate-spin" /> 이미지 불러오는 중…
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className={cn("block w-full touch-none select-none", dragging ? "cursor-crosshair" : "cursor-crosshair")}
          />
        )}
      </div>

      {/* 박스 목록 */}
      <div className="rounded-2xl border border-navy-100 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-navy-800">
            박스 {boxes.length}개 {dirty && <span className="text-orange-400">· 저장 안 됨</span>}
          </span>
          <div className="flex gap-2">
            {boxes.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { setBoxes([]); setSelected(null); setDirty(true); }}
                leftIcon={<Undo2 size={13} />} className="text-red-300">
                전체 지우기
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving}
              leftIcon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}>
              라벨 저장
            </Button>
          </div>
        </div>

        {boxes.length === 0 ? (
          <p className="py-3 text-center text-[12.5px] text-navy-400">
            박스가 없습니다. 물체가 없는 사진이면 그대로 저장해 &quot;물체 없음&quot; 샘플로 쓸 수 있습니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {boxes.map((b, i) => {
              const name = (YOLO_CLASSES[b.classId] ?? "fish") as YoloClassName;
              return (
                <li
                  key={i}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors",
                    selected === i ? "bg-white/[0.07]" : "bg-white/[0.03]",
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: YOLO_CLASS_COLOR[name] }} />
                  <select
                    value={b.classId}
                    onChange={(e) => changeClass(i, Number(e.target.value))}
                    className="field h-8 w-auto min-w-[110px] py-0 text-[12.5px]"
                  >
                    {YOLO_CLASSES.map((n, id) => (
                      <option key={n} value={id}>{YOLO_CLASS_LABEL[n]}</option>
                    ))}
                  </select>
                  <span className="text-[11.5px] tabular-nums text-navy-400">
                    {(b.cx * 100).toFixed(1)}%, {(b.cy * 100).toFixed(1)}% · {(b.w * 100).toFixed(1)}×{(b.h * 100).toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBox(i)}
                    className="ml-auto rounded-lg p-1.5 text-red-300 transition-colors hover:bg-red-500/10"
                    aria-label="박스 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {msg && <p className="mt-2 text-[12px] text-orange-400">{msg}</p>}
      </div>
    </div>
  );
}
