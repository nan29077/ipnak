"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 중고마켓 상품 상세 — 이미지 슬라이더
 * - 터치 스와이프로 자연스럽게 이동 (snap 아님)
 * - 0.32s ease-out 트랜지션
 * - 도트 인디케이터 + 카운터
 */
export function MarketGallery({
  images,
  dim,
  statusLabel,
}: {
  images: string[];
  dim?: boolean;
  statusLabel?: string | null;
}) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [sliding, setSliding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dirLocked = useRef<"horiz" | "vert" | null>(null);
  const multi = images.length > 1;

  function getW() {
    return containerRef.current?.offsetWidth ?? 0;
  }

  function goTo(i: number) {
    setIdx(Math.max(0, Math.min(images.length - 1, i)));
    setDrag(0);
    setSliding(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dirLocked.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!dirLocked.current) {
      if (Math.abs(dy) > Math.abs(dx) + 5) {
        dirLocked.current = "vert";
        return;
      }
      if (Math.abs(dx) > 5) {
        dirLocked.current = "horiz";
        setSliding(true);
      }
    }
    if (dirLocked.current !== "horiz") return;
    setDrag(dx);
  }

  function onTouchEnd() {
    if (dirLocked.current !== "horiz") { setSliding(false); return; }
    const threshold = getW() * 0.2;
    if (drag < -threshold && idx < images.length - 1) goTo(idx + 1);
    else if (drag > threshold && idx > 0) goTo(idx - 1);
    else goTo(idx);
  }

  // 트랙 x 위치 = 현재 이미지 위치 + 드래그 오프셋
  const tx = -idx * getW() + drag;

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full select-none overflow-hidden bg-navy-50"
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── 슬라이드 트랙 ── */}
      <div
        style={{
          display: "flex",
          height: "100%",
          width: `${images.length * 100}%`,
          transform: `translateX(${tx}px)`,
          transition: sliding ? "none" : "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          willChange: "transform",
        }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            style={{ width: `${100 / images.length}%`, height: "100%", flexShrink: 0 }}
          >
            <img
              src={src}
              alt={`상품 사진 ${i + 1}`}
              decoding="async"
              draggable={false}
              className={cn("h-full w-full object-cover", dim && "opacity-60")}
            />
          </div>
        ))}
      </div>

      {/* ── 판매 상태 오버레이 ── */}
      {statusLabel && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[15px] font-bold text-white">
            {statusLabel}
          </span>
        </div>
      )}

      {/* ── 이미지 카운터 (우상단) ── */}
      {multi && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm">
          {idx + 1} / {images.length}
        </div>
      )}

      {/* ── 도트 인디케이터 (하단 중앙) ── */}
      {multi && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`사진 ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === idx ? "w-5 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
