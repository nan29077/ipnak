"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollRailProps {
  children: React.ReactNode;
  /** overflow-x-auto flex 등 스크롤 컨테이너에 적용할 클래스 */
  className?: string;
  /** 한 번 클릭 시 스크롤 이동량(px). 기본 300 */
  scrollAmount?: number;
}

/**
 * PC(md+)에서 좌/우 화살표 버튼을 표시하는 가로 스크롤 래퍼.
 * 모바일에서는 버튼이 hidden 처리되어 기존 swipe 동작 유지.
 */
export function ScrollRail({ children, className, scrollAmount = 300 }: ScrollRailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* 왼쪽 화살표 — PC 전용 */}
      <button
        onClick={() => scroll(-1)}
        aria-label="이전"
        className={[
          "hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10",
          "h-9 w-9 items-center justify-center rounded-full",
          "bg-[#1e1e1e]/90 border border-navy-100 shadow-lg",
          "text-navy-600 hover:text-orange-400 hover:border-orange-400/40",
          "transition-all duration-200",
          canLeft ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <ChevronLeft size={18} />
      </button>

      {/* 스크롤 컨테이너 */}
      <div ref={ref} className={className}>
        {children}
      </div>

      {/* 오른쪽 화살표 — PC 전용 */}
      <button
        onClick={() => scroll(1)}
        aria-label="다음"
        className={[
          "hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10",
          "h-9 w-9 items-center justify-center rounded-full",
          "bg-[#1e1e1e]/90 border border-navy-100 shadow-lg",
          "text-navy-600 hover:text-orange-400 hover:border-orange-400/40",
          "transition-all duration-200",
          canRight ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
