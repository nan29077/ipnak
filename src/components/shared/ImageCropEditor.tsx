"use client";
/**
 * ImageCropEditor — 인스타그램 스타일 이미지 크롭 에디터
 *
 * 사진 첨부 시 피드 프레임(기본 1:1) 안에서 핀치/휠 줌 + 드래그로 위치를 조정한다.
 * - 확대하면 원하는 부분만 크롭되어 올라간다.
 * - 축소해서 프레임에 여백이 생기면 같은 사진의 블러 버전이 배경으로 채워진다.
 * 외부 라이브러리 없이 React + Canvas API만 사용한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Maximize2, Minimize2, X } from "lucide-react";

export type ImageCropEditorProps = {
  /** 편집할 원본 파일 */
  file: File;
  /** 프레임 가로/세로 비율 (1 = 정사각 피드 카드, 4/3 등) */
  aspect?: number;
  /** 결과 이미지 가로 픽셀 (기본 1080) */
  outputWidth?: number;
  /** 상단 타이틀 (예: "사진 편집 (2/3)") */
  title?: string;
  /** 편집 완료 — 크롭된 JPEG Blob */
  onComplete: (croppedBlob: Blob) => void;
  /** 취소 */
  onCancel: () => void;
  /** 이미지 로드/변환 실패 시 사유 전달 (선택) */
  onError?: (message: string) => void;
};

type View = { scale: number; x: number; y: number };

/** contain 대비 얼마나 더 줄일 수 있는지 (여백 = 블러 배경) */
const MIN_ZOOM_MULT = 0.7;
/** cover 대비 최대 확대 배율 */
const MAX_ZOOM_MULT = 5;

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

/** 프레임/이미지 기준 배율 한계 */
function scaleBounds(iw: number, ih: number, fw: number, fh: number) {
  const cover = Math.max(fw / iw, fh / ih);
  const contain = Math.min(fw / iw, fh / ih);
  return { cover, contain, min: contain * MIN_ZOOM_MULT, max: cover * MAX_ZOOM_MULT };
}

/** 배율/이동값을 프레임 밖으로 새지 않게 보정 (이미지가 프레임보다 작으면 가운데 고정) */
function clampView(v: View, iw: number, ih: number, fw: number, fh: number): View {
  const { min, max } = scaleBounds(iw, ih, fw, fh);
  const scale = clamp(v.scale, min, max);
  const limitX = Math.max(0, (iw * scale - fw) / 2);
  const limitY = Math.max(0, (ih * scale - fh) / 2);
  return { scale, x: clamp(v.x, -limitX, limitX), y: clamp(v.y, -limitY, limitY) };
}

/** 여백 채움용 블러 배경 — 작은 캔버스로 줄였다가 확대해 흐리게 만든다 (ctx.filter 미지원 브라우저 대응) */
function drawBlurBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const sw = 48;
  const sh = Math.max(1, Math.round((sw * h) / w));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d");
  if (!sctx) return;
  const s = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  sctx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.filter = `blur(${Math.max(4, Math.round(w * 0.02))}px)`;
  } catch {
    /* filter 미지원 — 축소/확대만으로도 충분히 흐려진다 */
  }
  const over = 1.16; // 가장자리 비는 것 방지
  ctx.drawImage(small, -(w * (over - 1)) / 2, -(h * (over - 1)) / 2, w * over, h * over);
  ctx.restore();
}

export function ImageCropEditor({
  file,
  aspect = 1,
  outputWidth = 1080,
  title = "사진 편집",
  onComplete,
  onCancel,
  onError,
}: ImageCropEditorProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const metaRef = useRef({ iw: 0, ih: 0 });
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 });
  const initedRef = useRef(false);
  const errorCbRef = useRef(onError);
  errorCbRef.current = onError;

  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

  const apply = useCallback((next: View) => {
    const { iw, ih } = metaRef.current;
    const fr = frameRef.current;
    if (!iw || !fr) return;
    const clamped = clampView(next, iw, ih, fr.clientWidth, fr.clientHeight);
    viewRef.current = clamped;
    setView(clamped);
  }, []);

  /* 원본 로드 */
  useEffect(() => {
    // alive 가드 — 언마운트(개발 모드의 StrictMode 재실행 포함) 후 뒤늦게 도착하는
    // load/error 콜백이 상태를 건드리지 않도록 한다.
    let alive = true;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setReady(false);
    setErr("");
    initedRef.current = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!alive) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        setErr("이미지 크기를 읽을 수 없습니다.");
        errorCbRef.current?.("이미지 크기를 읽을 수 없습니다.");
        return;
      }
      imgRef.current = img;
      metaRef.current = { iw: img.naturalWidth, ih: img.naturalHeight };
      setReady(true);
    };
    img.onerror = () => {
      if (!alive) return;
      setErr("이미지를 불러올 수 없습니다.");
      errorCbRef.current?.("이미지를 불러올 수 없습니다.");
    };
    img.src = objectUrl;
    return () => {
      alive = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  /* 프레임 크기 측정 (화면 회전/리사이즈 대응) */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => {
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      if (cw <= 0 || ch <= 0) return;
      const w = Math.round(Math.min(cw, ch * aspect));
      setFrame((prev) => {
        const next = { w, h: Math.round(w / aspect) };
        if (prev.w === next.w && prev.h === next.h) return prev;
        // 이미 편집 중이면 화면 크기 변화에 맞춰 배율/위치를 비례 보정
        if (prev.w > 0 && initedRef.current) {
          const k = next.w / prev.w;
          const v = viewRef.current;
          const scaled = { scale: v.scale * k, x: v.x * k, y: v.y * k };
          const { iw, ih } = metaRef.current;
          const c = iw ? clampView(scaled, iw, ih, next.w, next.h) : scaled;
          viewRef.current = c;
          setView(c);
        }
        return next;
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [aspect]);

  /* 최초 배치 — 인스타그램처럼 프레임을 꽉 채운 상태로 시작 */
  useEffect(() => {
    if (!ready || frame.w <= 0 || initedRef.current) return;
    const { iw, ih } = metaRef.current;
    const { cover } = scaleBounds(iw, ih, frame.w, frame.h);
    const init = { scale: cover, x: 0, y: 0 };
    viewRef.current = init;
    setView(init);
    initedRef.current = true;
  }, [ready, frame.w, frame.h]);

  /* 제스처 — 터치 핀치/드래그, 마우스 드래그, 휠 줌 */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !ready) return;

    let mode: "none" | "pan" | "pinch" = "none";
    let startPoint = { x: 0, y: 0 };
    let startView: View = { scale: 1, x: 0, y: 0 };
    let startDist = 0;
    let startMid = { x: 0, y: 0 };

    /** 화면 좌표 → 프레임 중심 기준 좌표 */
    const toLocal = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) };
    };
    const midOf = (t: TouchList) => toLocal((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
    const distOf = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    /** 확대/축소 시 손가락(커서) 아래 지점을 고정한 채 배율 변경 */
    const zoomAround = (rawScale: number, from: View, anchorBefore: { x: number; y: number }, anchorAfter: { x: number; y: number }) => {
      const { iw, ih } = metaRef.current;
      const { min, max } = scaleBounds(iw, ih, el.clientWidth, el.clientHeight);
      const scale = clamp(rawScale, min, max);
      const k = scale / from.scale;
      apply({
        scale,
        x: anchorAfter.x - (anchorBefore.x - from.x) * k,
        y: anchorAfter.y - (anchorBefore.y - from.y) * k,
      });
    };

    const beginPan = (cx: number, cy: number) => {
      mode = "pan";
      startPoint = { x: cx, y: cy };
      startView = { ...viewRef.current };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) beginPan(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length >= 2) {
        mode = "pinch";
        startDist = distOf(e.touches);
        startMid = midOf(e.touches);
        startView = { ...viewRef.current };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (mode === "none") return;
      e.preventDefault(); // 페이지 스크롤/브라우저 확대 방지
      if (mode === "pan" && e.touches.length === 1) {
        apply({
          scale: startView.scale,
          x: startView.x + (e.touches[0].clientX - startPoint.x),
          y: startView.y + (e.touches[0].clientY - startPoint.y),
        });
      } else if (mode === "pinch" && e.touches.length >= 2 && startDist > 0) {
        zoomAround(startView.scale * (distOf(e.touches) / startDist), startView, startMid, midOf(e.touches));
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) mode = "none";
      else if (e.touches.length === 1) beginPan(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (mode !== "pan") return;
      e.preventDefault();
      apply({
        scale: startView.scale,
        x: startView.x + (e.clientX - startPoint.x),
        y: startView.y + (e.clientY - startPoint.y),
      });
    };
    const onMouseUp = () => {
      mode = "none";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      beginPan(e.clientX, e.clientY);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = viewRef.current;
      const anchor = toLocal(e.clientX, e.clientY);
      zoomAround(cur.scale * Math.exp(-e.deltaY * 0.0018), cur, anchor, anchor);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [ready, apply]);

  /* 배경 스크롤 잠금 */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const bounds =
    ready && frame.w > 0 ? scaleBounds(metaRef.current.iw, metaRef.current.ih, frame.w, frame.h) : null;
  const isFilled = bounds ? view.scale >= bounds.cover - 0.0001 : true;

  /** 전체보기(블러 배경) ↔ 꽉 채우기 토글 */
  function toggleFit() {
    if (!bounds) return;
    apply({ scale: isFilled ? bounds.contain : bounds.cover, x: 0, y: 0 });
  }

  /** 슬라이더 줌 — 프레임 중심 기준 */
  function setScaleFromSlider(next: number) {
    const cur = viewRef.current;
    const k = next / cur.scale;
    apply({ scale: next, x: cur.x * k, y: cur.y * k });
  }

  async function handleComplete() {
    const img = imgRef.current;
    if (!img || frame.w <= 0 || saving) return;
    setSaving(true);
    try {
      const { iw, ih } = metaRef.current;
      const outW = Math.round(outputWidth);
      const outH = Math.round(outputWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas를 사용할 수 없습니다.");

      const v = viewRef.current;
      const f = outW / frame.w; // 화면 px → 출력 px
      const dw = iw * v.scale * f;
      const dh = ih * v.scale * f;
      const dx = outW / 2 + v.x * f - dw / 2;
      const dy = outH / 2 + v.y * f - dh / 2;

      // 여백이 생기는 경우에만 블러 배경을 깐다
      if (dx > 0.5 || dy > 0.5 || dx + dw < outW - 0.5 || dy + dh < outH - 0.5) {
        drawBlurBackground(ctx, img, outW, outH);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, dx, dy, dw, dh);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("이미지 변환에 실패했습니다.");
      onComplete(blob);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "이미지 변환에 실패했습니다.";
      setErr(msg);
      errorCbRef.current?.(msg);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10020] flex flex-col bg-[#0b1420] overscroll-contain">
      {/* 상단 바 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="취소"
        >
          <X size={22} />
        </button>
        <p className="text-[14px] font-semibold text-white">{title}</p>
        <button
          type="button"
          onClick={handleComplete}
          disabled={!ready || saving || !!err}
          className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-3 text-[14px] font-bold text-aqua-400 transition-colors hover:bg-white/10 disabled:opacity-40"
          aria-label="완료"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} />완료</>}
        </button>
      </div>

      {/* 프레임 */}
      <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={frameRef}
          className="relative overflow-hidden bg-black select-none"
          style={{
            width: frame.w || undefined,
            height: frame.h || undefined,
            touchAction: "none",
            cursor: ready ? "grab" : "default",
          }}
        >
          {url && ready && (
            <>
              {/* 여백 채움용 블러 배경 (완료 시 canvas로 동일하게 구워진다) */}
              <img
                src={url}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                style={{ filter: "blur(22px)", transform: "scale(1.18)" }}
              />
              <img
                src={url}
                alt="편집 중인 사진"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={{
                  width: metaRef.current.iw * view.scale,
                  height: metaRef.current.ih * view.scale,
                  transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px)`,
                  maxWidth: "none",
                }}
              />
              {/* 3분할 가이드 */}
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
              </div>
            </>
          )}
          {!ready && !err && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={26} className="animate-spin text-white/70" />
            </div>
          )}
          {err && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[13px] leading-relaxed text-red-300">{err}</p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="shrink-0 space-y-3 px-6 pb-6 pt-4">
        {bounds && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleFit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label={isFilled ? "사진 전체 보기" : "프레임 꽉 채우기"}
            >
              {isFilled ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              step={(bounds.max - bounds.min) / 200 || 0.001}
              value={view.scale}
              onChange={(e) => setScaleFromSlider(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-aqua-500"
              aria-label="확대 비율"
            />
          </div>
        )}
        <p className="text-center text-[11.5px] leading-relaxed text-white/50">
          두 손가락(또는 마우스 휠)으로 확대·축소, 드래그로 위치를 조정하세요.
          <br />
          축소하면 남는 여백은 사진의 흐린 배경으로 채워집니다.
        </p>
      </div>
    </div>
  );
}

export default ImageCropEditor;
