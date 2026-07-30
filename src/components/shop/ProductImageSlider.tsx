"use client";

import { useRef, useState } from "react";
import { NO_IMAGE_SRC } from "@/lib/noImage";

interface ProductImageSliderProps {
  images: string[];
}

export function ProductImageSlider({ images }: ProductImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentIndex(idx);
  }

  function goTo(idx: number) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setCurrentIndex(idx);
  }

  if (images.length === 0) {
    return (
      <img
        src={NO_IMAGE_SRC}
        alt="이미지 없음"
        className="aspect-square w-full object-cover"
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex overflow-x-scroll scrollbar-none aspect-square"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {images.map((url, i) => (
          <div
            key={i}
            className="aspect-square w-full shrink-0"
            style={{ scrollSnapAlign: "center" } as React.CSSProperties}
          >
            <img
              src={url}
              alt={`상품 이미지 ${i + 1}`}
              decoding="async"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = NO_IMAGE_SRC;
              }}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={"h-1.5 rounded-full transition-all " + (i === currentIndex ? "w-5 bg-orange-400" : "w-1.5 bg-white/40")}
              aria-label={"이미지 " + (i + 1)}
            />
          ))}
        </div>
      )}

      {images.length > 1 && (
        <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
