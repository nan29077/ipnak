"use client";
import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 피드 상세 페이지 래퍼 — 화면 최상단에서 아래로 80px 이상 드래그하면
 * 페이지가 아래로 미끄러져 사라진 후 이전 페이지로 돌아감
 */
export function PostDetailClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const directionLockedRef = useRef<"vertical" | "horizontal" | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 종료 애니메이션 타이머 정리 — 다른 경로로 이동한 뒤 router.back() 중복 실행 방지
  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  // 상세 페이지에서 AppShell main의 min-h-screen / flex stretch를 해제해 하단 빈 공간 제거.
  // 하단 패딩(main의 .pb-bottom-nav)도 함께 걷어내고, 대신 아래 래퍼의 .pb-bottom-nav 로
  // 하단 네비게이션 바 높이만큼만 확보한다 — 반응형 분기는 CSS 미디어 쿼리가 처리.
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const el = main as HTMLElement;
    el.style.minHeight = "0";
    el.style.alignSelf = "flex-start";
    el.style.paddingBottom = "0";
    return () => {
      el.style.minHeight = "";
      el.style.alignSelf = "";
      el.style.paddingBottom = "";
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isExiting) return;
    // 바텀시트·모달이 열려 있으면 페이지 스와이프 비활성 — 시트 자체 드래그 닫기만 동작
    if (document.querySelector('[role="dialog"]')) return;
    const scrollEl = containerRef.current;
    if (scrollEl && scrollEl.scrollTop > 0) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    directionLockedRef.current = null;
    isDraggingRef.current = false;
  }, [isExiting]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null || isExiting) return;
    const scrollEl = containerRef.current;
    if (scrollEl && scrollEl.scrollTop > 0) {
      touchStartYRef.current = null;
      setDragY(0);
      return;
    }
    const dy = e.touches[0].clientY - touchStartYRef.current;
    const dx = Math.abs(e.touches[0].clientX - (touchStartXRef.current ?? 0));

    // 방향 아직 미확정 — 10px 이상 움직였을 때 방향 결정
    if (!directionLockedRef.current) {
      if (dx < 10 && Math.abs(dy) < 10) return; // 아직 방향 불명확
      directionLockedRef.current = dx > Math.abs(dy) ? "horizontal" : "vertical";
    }

    // 가로 방향으로 결정됐으면 페이지 드래그 완전히 무시 (캐러셀 슬라이드 중)
    if (directionLockedRef.current === "horizontal") {
      touchStartYRef.current = null;
      return;
    }

    if (dy <= 0) return;
    isDraggingRef.current = true;
    setDragY(Math.sqrt(dy) * 4);
  }, [isExiting]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null || isExiting) return;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    touchStartXRef.current = null;
    directionLockedRef.current = null;
    isDraggingRef.current = false;

    if (dy >= 80) {
      // 슬라이드 다운 종료 애니메이션 후 뒤로가기
      setDragY(0);
      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => router.back(), 320);
    } else {
      setDragY(0);
    }
  }, [router, isExiting]);

  // 현재 transform 값 결정
  const transform = isExiting
    ? "translateY(100vh)"
    : dragY > 0
    ? `translateY(${dragY}px)`
    : undefined;

  // transition: 종료 애니메이션은 빠른 ease-in, 드래그 중엔 없음, 복귀 시엔 spring
  const transition = isExiting
    ? "transform 0.32s cubic-bezier(0.4, 0, 1, 1)"
    : dragY > 0
    ? "none"
    : "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  return (
    <div
      ref={containerRef}
      className="pb-bottom-nav relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform, transition }}
    >
      {/* 당기기 표시 인디케이터 */}
      {dragY > 8 && !isExiting && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white backdrop-blur-sm"
          style={{ opacity: Math.min(1, dragY / 40) }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          놓으면 뒤로 가기
        </div>
      )}
      {children}
    </div>
  );
}
