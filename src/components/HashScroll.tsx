"use client";

import { useEffect } from "react";

/**
 * 해시(#entry, #ranking …)를 달고 들어온 경우 해당 섹션으로 스크롤한다.
 * 서버 컴포넌트 페이지는 내용이 붙는 시점이 브라우저 기본 해시 스크롤보다 늦을 수 있어
 * 마운트 후 한 번 더 직접 스크롤을 걸어준다.
 */
export function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return null;
}
