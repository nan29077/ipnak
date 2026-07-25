"use client";
import { useEffect, useRef } from "react";

/**
 * 채팅 전용 풀스크린 레이아웃.
 * - fixed inset-x-0 top-0 z-[60]: 하단 네비(z-40)를 완전히 덮음
 * - visualViewport API로 iOS/Android 키보드 등장 시 높이 동적 조정
 *   → 메시지 영역이 줄어들고 입력창은 항상 키보드 바로 위에 고정
 */
export function MarketChatLayout({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      if (!ref.current) return;
      const vp = window.visualViewport;
      if (vp) {
        ref.current.style.height = `${vp.height}px`;
        ref.current.style.top = `${vp.offsetTop}px`;
      }
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 top-0 z-[60] flex flex-col bg-[#0d1b2a]"
      style={{ height: "100dvh" }}
    >
      {children}
    </div>
  );
}
